/**
 * 행정구역이 언제 어떻게 바뀌었는지 뽑는다.  실행: `npm run build:changes`
 *
 * 원본은 통계청 SGIS 센서스용 행정구역경계 31개 시점(1975~2025)이다.
 * 5년 단위로 1975~2000, 1년 단위로 2001~2025. 자료 신청이 필요해 자동으로
 * 내려받지 못하므로, 받은 zip을 `data/geo/source/sgis/`에 두고 돌린다.
 *
 * 결과는 지도가 아니라 **사건 목록**이다. 시점마다 코스를 내면 서른한 개 중
 * 스물셋이 앞 것과 똑같은 지도가 되지만, 바뀐 순간만 모으면 전부 다른
 * 내용이 된다. `data/reference/boundary-changes.json`에 쓴다.
 */
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "data/geo/source/sgis");
const OUT = join(ROOT, "data/reference/boundary-changes.json");

/**
 * 원본 필드명. **해마다 규칙이 다르다.**
 *   1975  sido_cd · sido_nm · base_year   (소문자)
 *   2014  SIDO_CD · SIDO_NM · BASE_YEAR   (대문자)
 *   2025  SIDO_CD · SIDO_NM · BASE_DATE   (기준일이 20250630 꼴로 바뀜)
 * 대소문자만 다르므로 낮춰서 맞춘다.
 */
const FIELDS = {
  sido: ["sido_cd", "sido_nm"],
  sigungu: ["sigungu_cd", "sigungu_nm"],
} as const;

type Level = keyof typeof FIELDS;
type Row = { code: string; name: string };

/** 한 해치 zip에서 한 층의 속성만 읽는다. 도형은 열지 않는다 — 이름만 있으면 된다. */
async function readLevel(year: string, level: Level, outer: string): Promise<Row[]> {
  const dir = await mkdtemp(join(tmpdir(), `sgis-${year}-`));
  try {
    // zip 안에 zip이 셋(sido·sigungu·dong) 들어 있다. 필요한 하나만 꺼낸다.
    await run("unzip", ["-q", "-o", join(SOURCE_DIR, outer), `bnd_${level}_*`, "-d", dir]);
    const inner = (await readdir(dir)).find((f) => f.endsWith(".zip"));
    if (!inner) throw new Error(`${year} ${level}: 안쪽 zip 없음`);
    await run("unzip", ["-q", "-o", join(dir, inner), "-d", dir]);

    // 파일 이름 규칙도 해마다 다르다(BND_SIDO_PG_2014 / bnd_sido_00_2025_2Q).
    const base = (await readdir(dir)).find((f) => f.endsWith(".shp"))?.replace(/\.shp$/, "");
    if (!base) throw new Error(`${year} ${level}: shp 없음`);

    const mapshaper = (await import("mapshaper")).default;
    const result = await mapshaper.applyCommands("-i in.shp -o out.csv format=csv", {
      "in.shp": await readFile(join(dir, `${base}.shp`)),
      "in.dbf": await readFile(join(dir, `${base}.dbf`)),
    });

    const text = Buffer.from(result["out.csv"]).toString();
    const lines = text.trim().split("\n");
    const head = lines[0].split(",").map((s) => s.replace(/^"|"$/g, "").toLowerCase());
    const [cdKey, nmKey] = FIELDS[level];
    const iC = head.indexOf(cdKey);
    const iN = head.indexOf(nmKey);
    if (iC < 0 || iN < 0) throw new Error(`${year} ${level}: 필드 없음 (${head.join(",")})`);

    const rows: Row[] = [];
    for (const line of lines.slice(1)) {
      const cells = (line.match(/("([^"]|"")*"|[^,]*)/g) ?? []).filter((_, i) => i % 2 === 0);
      const code = (cells[iC] ?? "").replace(/^"|"$/g, "").trim();
      const name = (cells[iN] ?? "").replace(/^"|"$/g, "").trim();
      if (code && name) rows.push({ code, name });
    }
    return rows;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/*
 * 띄어쓰기는 의미가 없다.
 *
 * 원본이 `수원시 장안구`와 `수원시장안구` 사이를 네 번(2002·2004·2005·2016)
 * 오간다. 행정구역이 바뀐 것이 아니라 그해 표기가 달랐을 뿐이다.
 */
const norm = (s: string): string => s.replace(/\s+/g, "");

/**
 * 한쪽 이름이 다른 쪽을 품고 있으면 같은 곳으로 본다.
 *
 * `포항시남구`와 `남구`가 2010·2011·2013에 오간다 — 자치구 이름에 모시(母市)를
 * 붙이는지가 해마다 달랐다. 다만 뒤가 겹치는지만 보면 **`강남구`가 `남구`를
 * 품어** 서로 다른 두 구가 한 곳으로 묶인다. 떼어낸 앞부분이 시·군으로
 * 끝날 때만 인정한다.
 */
function samePlace(a: string, b: string): boolean {
  if (a === b) return false;
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  if (!long.endsWith(short)) return false;
  return /[시군]$/.test(long.slice(0, long.length - short.length));
}

/**
 * 무엇을 "같은 곳"으로 볼 것인가 — **층마다 다르다.**
 *
 * 시도는 코드가 31년 내내 고정이다(21은 언제나 부산). 그래서 코드를 쥐고
 * 보면 `부산직할시 → 부산광역시`가 개명으로 잡힌다.
 *
 * 시군구는 그럴 수 없다. 코드가 지역의 정체성이 아니라 그해의 일련번호라,
 * 이름이 하나도 안 바뀐 2021→2022에도 "신설 82 · 폐지 82"가 잡힌다
 * (기장군 21310 → 기장군 21510). 대신 시도 접두사와 이름으로 맞춘다 —
 * 이름만으로는 안 된다, `중구`는 여섯 도시에 있다.
 *
 * 그 대가로 **시군구의 개명은 개명으로 잡히지 않는다.** 이름이 정체성이니
 * 이름이 바뀌면 다른 곳이 된다(`남구` → `미추홀구`가 사라짐+생김으로 나온다).
 * 그 둘을 잇는 것은 자료가 아니라 사람이 아는 사실이라, 여기서 짐작하지 않는다.
 */
function index(rows: Row[], level: Level): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const r of rows) {
    // 출장소는 시군구가 아니라 그 아래 파견 기구다. 낼 이름이 아니다.
    if (r.name.includes("출장소")) continue;
    map.set(level === "sido" ? r.code : `${r.code.slice(0, 2)}:${norm(r.name)}`, r);
  }
  return map;
}

interface Change {
  from: string;
  to: string;
  total: number;
  born: string[];
  gone: string[];
  /** 같은 곳이 이름만 바뀐 것. 코드가 안정적인 시도에서만 잡힌다. */
  renamed: string[];
  /** 같은 곳인데 표기만 달라진 짝. 사건이 아니라 걷어냈다는 기록이다. */
  spelling: string[];
}

const files = (await readdir(SOURCE_DIR).catch(() => [])).filter((f) => f.startsWith("bnd_all"));
if (files.length === 0) {
  throw new Error(
    `${SOURCE_DIR}에 원본이 없다.\n` +
      "SGIS(sgis.mods.go.kr) 자료제공에서 센서스용 행정구역경계를 신청해 받은 뒤\n" +
      "bnd_all_00_<연도>_<분기>Q.zip 들을 그 폴더에 둔다.",
  );
}
const years = [...new Set(files.map((f) => f.match(/_(\d{4})_/)?.[1]).filter(Boolean))].sort() as string[];
const fileOf = (y: string): string => files.find((f) => f.includes(`_${y}_`))!;

process.stdout.write(`시점 ${years.length}개 · ${years[0]} ~ ${years.at(-1)}\n`);

const out: Record<Level, Change[]> = { sido: [], sigungu: [] };

for (const level of ["sido", "sigungu"] as const) {
  let prev: Map<string, Row> | null = null;
  let prevYear = "";

  for (const year of years) {
    const cur = index(await readLevel(year, level, fileOf(year)), level);

    if (prev) {
      let gone = [...prev].filter(([k]) => !cur.has(k));
      let born = [...cur].filter(([k]) => !prev!.has(k));
      const spelling: string[] = [];

      // 정체성은 그대로인데 이름만 달라진 것. 시도에서만 나온다.
      const renamed: string[] = [];
      for (const [k, v] of cur) {
        const was = prev.get(k);
        if (!was || was.name === v.name) continue;
        if (norm(was.name) === norm(v.name)) spelling.push(`${was.name} → ${v.name}`);
        else renamed.push(`${was.name} → ${v.name}`);
      }

      // 모시 접두사만 붙었다 떨어진 짝을 걷어낸다.
      for (const g of [...gone]) {
        const [gSido, gName] = g[0].split(":");
        const hit = born.find(([k]) => {
          const [bSido, bName] = k.split(":");
          return bSido === gSido && samePlace(gName, bName);
        });
        if (!hit) continue;
        spelling.push(`${g[1].name} → ${hit[1].name}`);
        gone = gone.filter((x) => x !== g);
        born = born.filter((x) => x !== hit);
      }

      if (gone.length || born.length || renamed.length) {
        out[level].push({
          from: prevYear,
          to: year,
          total: cur.size,
          born: born.map(([, v]) => v.name),
          gone: gone.map(([, v]) => v.name),
          renamed,
          spelling,
        });
      }
    }
    prev = cur;
    prevYear = year;
  }

  process.stdout.write(`  ${level} 사건 ${out[level].length}건\n`);
}

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      _source: "통계청 SGIS 센서스용 행정구역경계 (1975~2025, 31개 시점)",
      _note:
        "빌드·참조 전용. 지도가 아니라 바뀐 순간의 목록이다. npm run build:changes로 다시 만든다.",
      _caveats: [
        "제주 2009·2010은 원본의 오류다. 제주특별자치도는 2006년 출범 뒤 되돌아간 적이 없는데, 2009년 판만 '제주도'로 적혀 있어 개명이 두 번 더 잡힌다.",
        "시군구는 개명이 개명으로 잡히지 않는다. 코드를 못 믿어 이름을 정체성으로 쓰기 때문이다 — 인천 남구→미추홀구(2018)가 사라짐+생김으로 나온다.",
        "5년 단위인 1975~2000 구간은 한 사건에 여러 해의 변화가 뭉쳐 있다.",
      ],
      retrievedAt: "2026-08-17",
      ...out,
    },
    null,
    1,
  )}\n`,
);

process.stdout.write(`\n${OUT} 씀\n`);

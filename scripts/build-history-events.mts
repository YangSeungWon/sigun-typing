/**
 * 행정구역 개편 사건마다 전후 지도를 굽는다.  실행: `npm run build:events`
 *
 * `/history`의 타임랩스는 전국 시도만 보여 준다. 시군구 개편은 그 축척에서
 * 몇 픽셀이라 — 창원 통합도 청주 통합도 안 보인다. 사건은 **자기 자리를
 * 확대해야** 보인다.
 *
 * 그래서 사건마다 그 일이 일어난 시도만 잘라, 그해와 앞 시점을 같은 투영으로
 * 나란히 굽는다. 바뀐 곳은 표시해 두었다가 화면에서 다르게 칠한다.
 *
 * 사건은 **연도로 묶는다.** 2012년 세종 신설은 시도에도 시군구에도 걸리지만
 * 한 사건이다.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import changes from "../data/reference/boundary-changes.json" with { type: "json" };
import { SIDO_EVENT_BY_YEAR, SIGUNGU_EVENT_BY_YEAR } from "../data/reference/admin-events.ts";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "data/geo/source/sgis");
const OUT = join(ROOT, "data/timelapse/events.json");

const WIDTH = 460;
const HEIGHT = 460;

/** 잘라 낸 시도 하나를 이 판에 담으므로 전국 타임랩스보다 곱게 남긴다. */
const RESOLUTION = "900x900";
const MIN_ISLAND_AREA = 20_000_000;

/** 제주 2009·2010은 원본의 오류다(boundary-changes.json의 _caveats). */
const SOURCE_ERRORS = new Set(["2009", "2010"]);

type Level = "sido" | "sigungu";

interface Shape {
  code: string;
  name: string;
  d: string;
}

interface Side {
  /** 단추에 적을 시점. `2011`이거나 `2012.01`이다. */
  year: string;
  regions: Shape[];
  /** 이 시점에서 눈여겨볼 곳. */
  marked: string[];
  /** 짚은 것이 사라질 것인가 생긴 것인가. 화면의 색이 갈린다. */
  tone: "gone" | "born";
}

interface Named {
  name: string;
  /** 지도에서 짚을 도형. 이름이 도형과 안 맞으면 없다. */
  code?: string;
}

interface Change {
  /** 시행일. 손으로 적은 것이 있을 때만. */
  on?: string;
  from: Named[];
  to: Named[];
}

interface Event {
  /** 자료에 처음 나타난 해. 주소가 되므로 바뀌면 안 된다. */
  year: string;
  /**
   * 크게 뜨는 해 — 실제로 그 일이 있었던 해다.
   *
   * 자료의 해가 아니다. 1년 단위인 2001년 이후에도 자료가 개편을 곧바로
   * 따라가지 않는다(제주는 2006년 출범인데 2007년 판에서야 바뀐다).
   * 손으로 적어 둔 것이 있으면 그것을, 없으면 자료의 해를 쓴다.
   */
  at: string;
  /** 실제 날짜를 아는가. 모르면 화면이 "자료에 처음 나타난 해"라고 밝힌다. */
  dated: boolean;
  /**
   * 무엇이 무엇으로 바뀌었는지. **문장이 아니라 짝**이다.
   *
   * 화면이 표로 그린다. 문장으로 넘기면 여러 건이 겹칠 때 가운뎃점으로
   * 늘어놓게 되고, 그러면 눈이 세로로 훑을 수가 없다.
   */
  changes: Change[];
  /** 제목·설명에 쓸 한 줄. 표를 글로 옮긴 것이라 화면에는 안 쓴다. */
  headline: string;
  /**
   * 앞에서 뒤로 가는 상태들. 보통 둘(전·후)이다.
   *
   * 한 판에 사건이 둘이면 셋이 된다 — 2012년에는 당진시(1월 1일)와
   * 세종시(7월 1일)가 함께 나타나는데, 그 사이 반년의 지도가 따로 있다.
   */
  states: Side[];
}

function prop(props: Record<string, unknown> | null | undefined, suffix: string): string {
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.toLowerCase().endsWith(suffix)) return String(v);
  }
  return "";
}

const cache = new Map<string, Feature<Geometry>[]>();

/** 한 해치 zip에서 한 층의 경계를 읽는다. 같은 해를 여러 사건이 쓰므로 캐시한다. */
async function read(year: string, level: Level, file: string): Promise<Feature<Geometry>[]> {
  const key = `${year}:${level}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const dir = await mkdtemp(join(tmpdir(), `ev-${year}-`));
  try {
    await run("unzip", ["-q", "-o", join(SOURCE_DIR, file), `bnd_${level}_*`, "-d", dir]);
    const inner = (await readdir(dir)).find((f) => f.endsWith(".zip"));
    if (!inner) throw new Error(`${year} ${level}: 안쪽 zip 없음`);
    await run("unzip", ["-q", "-o", join(dir, inner), "-d", dir]);
    const base = (await readdir(dir)).find((f) => f.endsWith(".shp"))?.replace(/\.shp$/, "");
    if (!base) throw new Error(`${year} ${level}: shp 없음`);

    const mapshaper = (await import("mapshaper")).default;
    const result = await mapshaper.applyCommands(
      `-i in.shp -filter-islands min-area=${MIN_ISLAND_AREA} ` +
        "-proj from=EPSG:5179 wgs84 -clean " +
        `-simplify visvalingam resolution=${RESOLUTION} keep-shapes ` +
        "-o out.json format=topojson",
      {
        "in.shp": await readFile(join(dir, `${base}.shp`)),
        "in.dbf": await readFile(join(dir, `${base}.dbf`)),
      },
    );
    const topo = JSON.parse(Buffer.from(result["out.json"]).toString()) as Topology;
    const objKey = Object.keys(topo.objects)[0];
    const fc = feature(topo, topo.objects[objKey] as GeometryCollection) as FeatureCollection;
    cache.set(key, fc.features);
    return fc.features;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const files = (await readdir(SOURCE_DIR).catch(() => [])).filter((f) => f.startsWith("bnd_all"));
if (files.length === 0) {
  throw new Error(`${SOURCE_DIR}에 원본이 없다. SGIS에서 신청해 받은 zip을 두세요.`);
}
const fileOf = (y: string) => files.find((f) => f.includes(`_${y}_`));
const years = [...new Set(files.map((f) => f.match(/_(\d{4})_/)?.[1]).filter(Boolean))].sort() as string[];

/*
 * 연도별로 사건을 모은다. 같은 해에 시도와 시군구가 함께 바뀌면 한 사건이다 —
 * 2012년의 세종이 그렇다.
 */
const byYear = new Map<string, { sido?: (typeof changes.sido)[number]; sigungu?: (typeof changes.sigungu)[number] }>();
for (const e of changes.sido) {
  if (SOURCE_ERRORS.has(e.to)) continue;
  byYear.set(e.to, { ...(byYear.get(e.to) ?? {}), sido: e });
}
for (const e of changes.sigungu) {
  byYear.set(e.to, { ...(byYear.get(e.to) ?? {}), sigungu: e });
}

const events: Event[] = [];

for (const [year, group] of [...byYear].sort()) {
  const prevYear = years[years.indexOf(year) - 1];
  if (!prevYear) continue;
  const [fileNow, filePrev] = [fileOf(year), fileOf(prevYear)];
  if (!fileNow || !filePrev) continue;

  /*
   * 어느 층을 그릴지 정한다.
   *
   * 시군구가 바뀐 해는 시군구를 그린다 — 시도만 그리면 창원 통합이 아무것도
   * 아닌 것처럼 보인다. 시도만 바뀐 해는 시도를 그린다.
   */
  const level: Level = group.sigungu ? "sigungu" : "sido";

  const [now, prev] = [await read(year, level, fileNow), await read(prevYear, level, filePrev)];
  const nameOf = (f: Feature<Geometry>) => prop(f.properties, "_nm");
  const codeOf = (f: Feature<Geometry>) => prop(f.properties, "_cd");

  /*
   * 무엇이 바뀌었는지 **도형으로 직접 가른다.**
   *
   * 사건 목록(boundary-changes.json)은 이름만 갖고 있어서 여기 쓸 수 없다 —
   * `남구`가 여섯 도시에 있어, 인천 남구가 미추홀구로 바뀐 해에 부산·대구·
   * 울산·광주의 남구까지 딸려 온다. 정체성은 시도 접두사와 이름이다
   * (build-changes.mts와 같은 규칙).
   */
  const key = (f: Feature<Geometry>) => `${codeOf(f).slice(0, 2)}:${nameOf(f).replace(/\s+/g, "")}`;
  const prevKeys = new Set(prev.map(key));
  const nowKeys = new Set(now.map(key));
  const bornSet = new Set(now.filter((f) => !prevKeys.has(key(f))).map(codeOf));
  const goneSet = new Set(prev.filter((f) => !nowKeys.has(key(f))).map(codeOf));

  /*
   * 바뀐 곳이 속한 시도만 남긴다. 전국을 그리면 다시 안 보이고, 바뀐 곳만
   * 그리면 어디인지 알 수 없다 — 그 도(道) 하나가 알맞은 그릇이다.
   */
  const touched = new Set(
    [
      ...now.filter((f) => bornSet.has(codeOf(f))),
      ...prev.filter((f) => goneSet.has(codeOf(f))),
    ].map((f) => codeOf(f).slice(0, 2)),
  );
  if (touched.size === 0) continue;

  /*
   * 시도 셋 이상에 걸치면 확대해도 안 보인다.
   *
   * 5년 단위인 1975~2000 구간이 그렇다. 그건 사건 하나가 아니라 다섯 해치
   * 변화가 뭉친 것이라(1988년 서울 5구 신설과 시 승격이 한 칸에 들어 있다)
   * 애초에 "이 일이 여기서 일어났다"고 가리킬 자리가 없다.
   */
  if (touched.size > 2) {
    process.stdout.write(`  ${prevYear}→${year} 시도 ${touched.size}곳에 걸침 — 건너뜀\n`);
    continue;
  }

  const inScope = (f: Feature<Geometry>) => touched.has(codeOf(f).slice(0, 2));
  const nowIn = now.filter(inScope);
  const prevIn = prev.filter(inScope);

  // 투영은 두 시점이 함께 쓴다. 따로 맞추면 전후를 견줄 수 없다.
  const projection = geoMercator().fitExtent(
    [
      [6, 6],
      [WIDTH - 6, HEIGHT - 6],
    ],
    { type: "FeatureCollection", features: [...nowIn, ...prevIn] } as FeatureCollection,
  );
  const path = geoPath(projection).digits(1);

  const shape = (f: Feature<Geometry>): Shape => ({
    code: codeOf(f),
    name: nameOf(f),
    d: path(f) ?? "",
  });

  /*
   * 손으로 적은 날짜가 있으면 그것이 이 사건의 문장이다.
   *
   * 도형에서 뽑은 문장은 무엇이 달라졌는지는 정확하지만(`창원시 사라짐`)
   * 그것이 통합인지 분리인지, 승격인지 편입인지 말해 주지 못한다.
   */
  const known = [
    ...(SIDO_EVENT_BY_YEAR.get(year)?.dates ?? []),
    ...(SIGUNGU_EVENT_BY_YEAR.get(year)?.dates ?? []),
  ]
    .sort((a, b) => a.on.localeCompare(b.on))
    /*
     * 같은 사건이 두 층에 적혀 있으면 한 줄로 남긴다.
     *
     * 세종 출범은 시도 목록에도 시군구 목록에도 있다 — 시도 쪽은
     * `충청남도 연기군 → 세종특별자치시`, 시군구 쪽은 `연기군 → 세종특별자치시`.
     * 같은 날 같은 결과이므로 한 사건이고, 어느 도에서 나왔는지까지 적힌
     * 쪽을 남긴다.
     */
    .filter((d, i, all) => {
      const same = all.filter((x) => x.on === d.on && (x.to ?? []).join() === (d.to ?? []).join());
      if (same.length < 2) return true;
      const best = same.reduce((a, b) =>
        (b.from ?? []).join().length > (a.from ?? []).join().length ? b : a,
      );
      return all.indexOf(best) === i;
    });

  /*
   * 무엇이 무엇으로 바뀌었는지를 **짝으로** 만든다.
   *
   * `화성시 생김 · 화성군 사라짐`은 두 사건처럼 읽히지만 실은 하나다 —
   * 화성군이 화성시로 승격한 것이다. 접미사를 뗀 이름이 같고 같은 시도에
   * 있으면 같은 곳으로 보고 한 줄에 담는다.
   *
   * 짝이 없는 것은 한쪽만 채운 줄로 남는다. 통합처럼 여럿이 하나가 되는
   * 사건은 이 규칙으로 못 잡으므로, 그런 것이야말로 손으로 적을 자리다.
   */
  const stem = (n: string) => n.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구)$/, "");
  const goneList = prev.filter((f) => goneSet.has(codeOf(f)));
  const bornList = now.filter((f) => bornSet.has(codeOf(f)));

  /** 손으로 적은 이름을 도형에 붙인다. 붙지 않으면 지도에서 못 짚을 뿐이다. */
  const locate = (name: string, pool: Feature<Geometry>[]): Named => {
    const hit = pool.find((f) => nameOf(f) === name || name.endsWith(nameOf(f)));
    return hit ? { name, code: codeOf(hit) } : { name };
  };

  let changes: Change[];
  if (known.length) {
    changes = known.map((d) => ({
      on: d.on.replace(/-/g, "."),
      from: (d.from ?? []).map((n) => locate(n, prevIn)),
      to: (d.to ?? []).map((n) => locate(n, nowIn)),
    }));
  } else {
    const leftGone = [...goneList];
    const leftBorn = [...bornList];
    const paired: Change[] = [];
    for (const g of [...leftGone]) {
      const twin = leftBorn.find(
        (b) =>
          codeOf(b).slice(0, 2) === codeOf(g).slice(0, 2) &&
          stem(nameOf(b)) === stem(nameOf(g)) &&
          nameOf(b) !== nameOf(g),
      );
      if (!twin) continue;
      paired.push({
        from: [{ name: nameOf(g), code: codeOf(g) }],
        to: [{ name: nameOf(twin), code: codeOf(twin) }],
      });
      leftGone.splice(leftGone.indexOf(g), 1);
      leftBorn.splice(leftBorn.indexOf(twin), 1);
    }
    changes = [
      ...(group.sido
        ? group.sido.renamed.map((r) => {
            const [a, b] = r.split(" → ");
            return { from: [{ name: a }], to: [{ name: b }] };
          })
        : []),
      ...paired,
      ...leftBorn.map((f) => ({ from: [], to: [{ name: nameOf(f), code: codeOf(f) }] })),
      ...leftGone.map((f) => ({ from: [{ name: nameOf(f), code: codeOf(f) }], to: [] })),
    ];
  }

  /** 제목·설명용 한 줄. 화면은 위의 짝을 쓴다. */
  const headline = changes
    .map((c) =>
      c.from.length && c.to.length
        ? `${c.from.map((x) => x.name).join(", ")} → ${c.to.map((x) => x.name).join(", ")}`
        : c.to.length
          ? `${c.to.map((x) => x.name).join(", ")} 생김`
          : `${c.from.map((x) => x.name).join(", ")} 사라짐`,
    )
    .join(", ");

  const atYears = [...new Set(known.map((d) => d.on.slice(0, 4)))];

  /*
   * 상태를 만든다.
   *
   * 보통은 앞뒤 둘이다. 한 판에 사건이 여럿이고 그중 **경계는 그대로고
   * 이름만 바뀐 것**이 있으면 그 사이 상태를 지어낼 수 있다 — 당진군이
   * 당진시가 된 것은 땅이 달라진 게 아니라, 앞 판의 도형에 이름만 갈아
   * 끼우면 그 시점의 지도가 된다.
   */
  const states: Side[] = [
    {
      year: prevYear,
      regions: prevIn.map(shape),
      marked: prevIn.filter((f) => goneSet.has(codeOf(f))).map(codeOf),
      tone: "gone",
    },
  ];

  const renaming = known.filter((d) => d.renames?.length);
  for (const d of renaming) {
    const byCode = new Map(d.renames!.map((r) => [r.code, r.to]));
    states.push({
      year: d.on.slice(0, 7).replace("-", "."),
      regions: prevIn.map((f) => {
        const to = byCode.get(codeOf(f));
        return to ? { ...shape(f), name: to } : shape(f);
      }),
      marked: [...byCode.keys()],
      tone: "born",
    });
  }

  states.push({
    year,
    regions: nowIn.map(shape),
    /*
     * 앞에서 이미 짚은 곳은 여기서 다시 짚지 않는다. 당진시는 1월에 생겼으니
     * 7월 지도에서 새것으로 보일 이유가 없다.
     */
    marked: nowIn
      .filter((f) => bornSet.has(codeOf(f)))
      .filter((f) => !renaming.some((d) => d.renames!.some((r) => r.to === nameOf(f))))
      .map(codeOf),
    tone: "born",
  });

  events.push({
    year,
    at: atYears.length === 0 ? year : atYears.length === 1 ? atYears[0] : `${atYears[0]}–${atYears.at(-1)}`,
    dated: known.length > 0,
    changes,
    headline,
    states,
  });
  process.stdout.write(`  ${prevYear}→${year} · ${level} · ${nowIn.length}곳\n`);
}

/*
 * 실제 날짜가 같은 사건은 하나로 합친다.
 *
 * 제주는 자료에서 둘로 갈라져 기록됐다 — 시군구(북제주군·남제주군 폐지)는
 * 2006년 판에, 시도(제주특별자치도)는 2007년 판에. 실제로는 2006년 7월 1일
 * 하루에 일어난 한 사건이라, 그대로 두면 화면에 `2006`이 두 번 뜬다.
 *
 * 지도는 시군구 쪽을 남긴다. 같은 사건을 더 잘게 보여 주는 그림이다.
 */
const merged: Event[] = [];
for (const e of events) {
  const twin = e.dated ? merged.find((m) => m.dated && m.at === e.at) : undefined;
  if (!twin) {
    merged.push(e);
    continue;
  }
  const parts = [...new Set([...twin.headline.split(" · "), ...e.headline.split(" · ")])];
  twin.headline = parts.sort().join(" · ");
  process.stdout.write(`  ${e.at} 두 기록을 합침 (/${twin.year}에 남김)\n`);
}
events.length = 0;
events.push(...merged);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  `${JSON.stringify({
    _source: "통계청 SGIS 센서스용 행정구역경계",
    _note: "개편 사건마다 그 일이 일어난 시도를 잘라 전후를 나란히 굽는다. npm run build:events.",
    width: WIDTH,
    height: HEIGHT,
    events,
  })}\n`,
);

process.stdout.write(
  `\n사건 ${events.length}개 · ${Math.round(JSON.stringify(events).length / 1024)}KB\n${OUT}\n`,
);

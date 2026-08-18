/**
 * 동네마다 읍면동이 어떻게 바뀌었는지 굽는다.  실행: `npm run build:dong-history`
 *
 * `/history`는 전국 연표다. 시도가 늘고 시군구가 합쳐진 이야기라 온 나라가
 * 함께 겪은 일이고, 거기 성북구 동 통폐합을 올리면 성격이 다른 목록이 된다.
 *
 * 그런데 **거기 살았던 사람에게는 그게 더 큰 사건**이다. 성북구가 동 서른
 * 개에서 스무 개가 된 2007년은 전국에는 아무 일도 아니지만 그 동네에는
 * 아니다. 그래서 층을 하나 내려 따로 굽고, 그 구의 코스에서 들어간다.
 *
 * 다 굽지 않는다. 한 해에 동이 셋 이상 움직인 곳만이다 — 하나둘 갈라진 것은
 * 자연스러운 변화라 사건이라 부를 만하지 않고, 그것까지 담으면 예순다섯
 * 곳이 된다.
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
import { COURSES } from "../data/courses/index.ts";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "data/geo/source/sgis");
const OUT = join(ROOT, "data/timelapse/dong-history.json");

const WIDTH = 460;
const HEIGHT = 460;
const RESOLUTION = "900x900";

/** 이만큼 움직여야 사건으로 본다. 하나둘 갈라진 것은 자연스러운 변화다. */
const THRESHOLD = 3;

/** 자료가 1년 단위가 되는 해부터. 그 전은 5년치가 뭉쳐 있어 사건을 못 가른다. */
const FROM_YEAR = 2001;

function prop(props: Record<string, unknown> | null | undefined, suffix: string): string {
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.toLowerCase().endsWith(suffix)) return String(v);
  }
  return "";
}

const cache = new Map<string, Feature<Geometry>[]>();
const sigunguCache = new Map<string, Map<string, string>>();

/**
 * 그해 시군구 코드 → `시도접두사:이름`.
 *
 * 읍면동을 코드 접두사로 묶으면 안 된다. SGIS 시군구 코드는 그해의
 * 일련번호라 2021→2022에 여든두 곳이 통째로 재배치됐다(기장군 21310 →
 * 21510). 그러면 같은 동네인데 자취가 끊긴다.
 *
 * 시도 접두사(21은 언제나 부산)와 이름은 안 흔들리므로 그것으로 묶는다.
 */
async function readSigungu(year: string, file: string): Promise<Map<string, string>> {
  const hit = sigunguCache.get(year);
  if (hit) return hit;

  const dir = await mkdtemp(join(tmpdir(), `dh-sgg-${year}-`));
  try {
    await run("unzip", ["-q", "-o", join(SOURCE_DIR, file), "*bnd_sigungu_*", "-d", dir]);
    const inner = (await readdir(dir)).find((f) => f.endsWith(".zip"));
    if (!inner) throw new Error(`${year}: 시군구 zip 없음`);
    await run("unzip", ["-q", "-o", join(dir, inner), "-d", dir]);
    const base = (await readdir(dir)).find((f) => f.endsWith(".shp"))?.replace(/\.shp$/, "");
    if (!base) throw new Error(`${year}: 시군구 shp 없음`);

    const mapshaper = (await import("mapshaper")).default;
    const result = await mapshaper.applyCommands("-i in.shp -o out.csv format=csv", {
      "in.shp": await readFile(join(dir, `${base}.shp`)),
      "in.dbf": await readFile(join(dir, `${base}.dbf`)),
    });
    const lines = Buffer.from(result["out.csv"]).toString().trim().split("\n");
    const head = lines[0].split(",").map((x) => x.toLowerCase());
    const iC = head.findIndex((x) => x.endsWith("_cd"));
    const iN = head.findIndex((x) => x.endsWith("_nm"));
    const map = new Map<string, string>();
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      const code = cells[iC]?.trim();
      const name = cells[iN]?.trim();
      if (code && name) map.set(code, `${code.slice(0, 2)}:${name.replace(/\s+/g, "")}`);
    }
    sigunguCache.set(year, map);
    return map;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** 한 해치 읍면동 전체. 마흔 곳이 같은 해를 쓰므로 캐시가 없으면 못 돈다. */
async function readDong(year: string, file: string): Promise<Feature<Geometry>[]> {
  const hit = cache.get(year);
  if (hit) return hit;

  const dir = await mkdtemp(join(tmpdir(), `dh-${year}-`));
  try {
    // 2021년만 안쪽 파일이 `01.bnd_dong_…`처럼 접두사를 달고 있다.
    await run("unzip", ["-q", "-o", join(SOURCE_DIR, file), "*bnd_dong_*", "-d", dir]);
    const inner = (await readdir(dir)).find((f) => f.endsWith(".zip"));
    if (!inner) throw new Error(`${year}: 안쪽 zip 없음`);
    await run("unzip", ["-q", "-o", join(dir, inner), "-d", dir]);
    const base = (await readdir(dir)).find((f) => f.endsWith(".shp"))?.replace(/\.shp$/, "");
    if (!base) throw new Error(`${year}: shp 없음`);

    const mapshaper = (await import("mapshaper")).default;
    const result = await mapshaper.applyCommands(
      "-i in.shp -proj from=EPSG:5179 wgs84 -clean " +
        `-simplify visvalingam resolution=${RESOLUTION} keep-shapes ` +
        "-o out.json format=topojson",
      {
        "in.shp": await readFile(join(dir, `${base}.shp`)),
        "in.dbf": await readFile(join(dir, `${base}.dbf`)),
      },
    );
    const topo = JSON.parse(Buffer.from(result["out.json"]).toString()) as Topology;
    const key = Object.keys(topo.objects)[0];
    const fc = feature(topo, topo.objects[key] as GeometryCollection) as FeatureCollection;
    cache.set(year, fc.features);
    return fc.features;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const files = (await readdir(SOURCE_DIR).catch(() => [])).filter((f) => f.startsWith("bnd_all"));
if (files.length === 0) throw new Error(`${SOURCE_DIR}에 원본이 없다.`);
const fileOf = (y: string) => files.find((f) => f.includes(`_${y}_`));
const years = [...new Set(files.map((f) => f.match(/_(\d{4})_/)?.[1]).filter(Boolean))]
  .sort()
  .filter((y) => Number(y) >= FROM_YEAR) as string[];

/*
 * 코스마다 잡을 범위.
 *
 * 앞 네 자리로 잡는다. 구가 생겼다 없어지면 코드가 바뀌기 때문이다 —
 * 부천은 31050과 31051~3을 오간다. 넷째 자리까지면 그 오감을 함께 잡는다.
 */
const targets = COURSES.filter((c) => c.level === "dong" && c.geo?.prefix).map((c) => {
  const sido = c.geo!.prefix!.slice(0, 2);
  /* `충청북도 청주시 상당구` → `청주시 상당구`. 시도 이름을 떼면 시군구 이름이다. */
  const parent = c.parentName ?? "";
  const own = parent.split(" ").slice(1).join("").replace(/\s+/g, "");
  return { id: c.id, name: c.name, parent, key: `${sido}:${own}` };
});

interface State {
  year: string;
  regions: { code: string; name: string; d: string }[];
}

const out: Record<string, { name: string; parent: string; states: State[] }> = {};
let scanned = 0;

for (const t of targets) {
  const counts: { year: string; features: Feature<Geometry>[] }[] = [];
  for (const y of years) {
    const file = fileOf(y);
    if (!file) continue;
    const [all, sgg] = [await readDong(y, file), await readSigungu(y, file)];
    counts.push({
      year: y,
      features: all.filter((f) => sgg.get(prop(f.properties, "_cd").slice(0, 5)) === t.key),
    });
  }
  scanned++;

  /*
   * 개수가 크게 움직인 해만 남긴다. 그 앞 해도 함께 남겨야 무엇이 달라졌는지
   * 견줄 수 있다.
   */
  const keep = new Set<string>();
  /* 그 해에 한 곳도 못 찾았으면 자취가 끊긴 것이다. 0을 변화로 세면 안 된다. */
  const solid = counts.filter((c) => c.features.length > 0);
  for (let i = 1; i < solid.length; i++) {
    if (Math.abs(solid[i].features.length - solid[i - 1].features.length) < THRESHOLD) continue;
    keep.add(solid[i - 1].year);
    keep.add(solid[i].year);
  }
  if (keep.size === 0) continue;

  const picked = solid.filter((c) => keep.has(c.year));
  // 투영은 모든 시점이 함께 쓴다. 조각 수가 달라져도 동네는 제자리여야 한다.
  const projection = geoMercator().fitExtent(
    [
      [6, 6],
      [WIDTH - 6, HEIGHT - 6],
    ],
    { type: "FeatureCollection", features: picked.flatMap((p) => p.features) } as FeatureCollection,
  );
  const path = geoPath(projection).digits(1);

  out[t.id] = {
    name: t.name,
    parent: t.parent,
    states: picked.map((p) => ({
      year: p.year,
      regions: p.features.map((f) => ({
        code: prop(f.properties, "_cd"),
        name: prop(f.properties, "_nm"),
        d: path(f) ?? "",
      })),
    })),
  };
  process.stdout.write(
    `  ${t.name} · ${picked.map((p) => `${p.year} ${p.features.length}곳`).join(" → ")}\n`,
  );
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(out)}\n`);
await writeFile(
  join(dirname(OUT), "dong-history-ids.json"),
  `${JSON.stringify(Object.keys(out))}\n`,
);

process.stdout.write(
  `\n훑은 코스 ${scanned}개 · 이야기 있는 곳 ${Object.keys(out).length}개 · ` +
    `${Math.round(JSON.stringify(out).length / 1024)}KB\n${OUT}\n`,
);

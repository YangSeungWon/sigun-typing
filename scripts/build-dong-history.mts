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
import { geoArea, geoCentroid, geoContains, geoMercator, geoPath } from "d3-geo";
import polylabel from "polylabel";
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
const RESOLUTION = "5000x5000";

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
}).filter((t) => !process.env.ONLY || process.env.ONLY.split(",").includes(t.id));

interface State {
  year: string;
  regions: { code: string; name: string; d: string }[];
  /** 앞 시점에서 이 시점으로 오며 무엇이 무엇이 됐는가. 첫 시점에는 없다. */
  changes?: { from: string[]; to: string[] }[];
}

/**
 * 도형 안쪽의 한 점. 한가운데는 도형 밖일 수 있다(고리 모양이거나 섬들이면).
 * `scripts/build-history-events.mts`의 같은 이름과 같은 일을 한다.
 */
function inside(f: Feature<Geometry>): [number, number] {
  const g = f.geometry;
  const polys =
    g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  if (polys.length === 0)
    return geoCentroid(f as Parameters<typeof geoCentroid>[0]) as [number, number];
  const area = (ring: number[][]) =>
    Math.abs(
      ring.reduce((sum, p, i) => {
        const q = ring[(i + 1) % ring.length];
        return sum + (p[0] * q[1] - q[0] * p[1]);
      }, 0),
    ) / 2;
  const biggest = polys.reduce((a, b) => (area(b[0]) > area(a[0]) ? b : a));
  return polylabel(biggest as [number, number][][], 0.0002) as [number, number];
}

/**
 * 무엇이 무엇이 됐는지를 **짝으로** 적는다.
 *
 * 이름만 늘어놓으면 `삼선1동, 삼선2동`이 사라졌다는 것까지는 보이는데
 * 어디로 갔는지가 없다. 사라진 동의 안쪽 점이 새 지도에서 어느 동 안에
 * 드는지를 보면 그것이 물려받은 곳이다.
 *
 * 새로 생긴 동이 사라진 동의 옛 땅 안에 있으면 그 줄에 함께 담는다 —
 * 하나가 여럿으로 나뉜 경우다(운정3동 → 운정3동·운정4동·운정5동).
 */
function pair(
  before: Feature<Geometry>[],
  after: Feature<Geometry>[],
): { from: string[]; to: string[] }[] {
  const nm = (f: Feature<Geometry>) => prop(f.properties, "_nm");
  const [wasNames, isNames] = [new Set(before.map(nm)), new Set(after.map(nm))];
  const gone = before.filter((f) => !isNames.has(nm(f)));
  const born = after.filter((f) => !wasNames.has(nm(f)));
  if (gone.length === 0 && born.length === 0) return [];

  const eaten = new Map<string, Feature<Geometry>[]>();
  const orphans: Feature<Geometry>[] = [];
  for (const g of gone) {
    const at = inside(g);
    const host = after.find((f) => geoContains(f as Parameters<typeof geoContains>[0], at));
    if (!host) {
      orphans.push(g);
      continue;
    }
    eaten.set(nm(host), [...(eaten.get(nm(host)) ?? []), g]);
  }

  const taken = new Set<Feature<Geometry>>();
  const extra = new Map<string, Feature<Geometry>[]>();
  for (const b of born) {
    if (eaten.has(nm(b))) continue;
    const at = inside(b);
    for (const [host, group] of eaten) {
      if (!group.some((g) => geoContains(g as Parameters<typeof geoContains>[0], at))) continue;
      extra.set(host, [...(extra.get(host) ?? []), b]);
      taken.add(b);
      break;
    }
  }

  return [
    ...[...eaten].map(([host, group]) => ({
      from: group.map(nm),
      to: [host, ...(extra.get(host) ?? []).map(nm)],
    })),
    ...born
      .filter((b) => !taken.has(b) && !eaten.has(nm(b)))
      .map((b) => ({ from: [], to: [nm(b)] })),
    ...orphans.map((g) => ({ from: [nm(g)], to: [] })),
  ];
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

  /**
   * 그 해에 이 시군구가 덮은 땅. 구면 넓이(steradian)라 단위는 뜻이 없고,
   * 해마다 견주는 데만 쓴다.
   */
  const ground = (c: (typeof solid)[number]) =>
    c.features.reduce((sum, f) => sum + geoArea(f as Parameters<typeof geoArea>[0]), 0);

  /**
   * 땅이 이만큼 넘게 달라졌으면 개편이 아니다.
   *
   * 철원은 2015년 판부터 원본이 미수복 네 면을 넣기 시작했고, 파주는 2021년
   * 판부터 민통선 안 세 면을 빼기 시작했다. 개수만 보면 각각 7→11, 20→17이라
   * 큰 통폐합처럼 보이는데, 실제로 달라진 것은 **원본이 담는 땅**이다.
   *
   * 진짜 개편은 안쪽 선만 움직인다 — 동이 합쳐지든 나뉘든 그 동네의 바깥
   * 테두리는 그대로다. 그래서 덮은 땅이 크게 달라졌으면 개편이 아니라 자료의
   * 일이거나, 구 경계 자체가 움직인 것이다(2004년 수원은 영통구가 생기면서
   * 장안구가 땅을 떼어 줬다 — 그건 동 통폐합 이야기가 아니다).
   *
   * 5%로 둔다. 해안선과 단순화 때문에 해마다 1~3%는 그냥 흔들린다.
   */
  const SAME_GROUND = 0.05;

  for (let i = 1; i < solid.length; i++) {
    if (Math.abs(solid[i].features.length - solid[i - 1].features.length) < THRESHOLD) continue;
    const [before, after] = [ground(solid[i - 1]), ground(solid[i])];
    if (Math.abs(after - before) / Math.max(before, after) > SAME_GROUND) continue;
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
    states: picked.map((p, i) => ({
      year: p.year,
      regions: p.features.map((f) => ({
        code: prop(f.properties, "_cd"),
        name: prop(f.properties, "_nm"),
        d: path(f) ?? "",
      })),
      ...(i > 0 ? { changes: pair(picked[i - 1].features, p.features) } : {}),
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

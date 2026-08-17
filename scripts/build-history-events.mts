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
  year: string;
  regions: Shape[];
  /** 이 시점에서 눈여겨볼 곳. 사라진 쪽과 생긴 쪽이 각각 다르다. */
  marked: string[];
}

interface Event {
  year: string;
  /** 이 해에 무슨 일이 있었는지. 시도와 시군구를 합쳐 적는다. */
  headline: string;
  before: Side;
  after: Side;
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

  const headline = [
    ...(group.sido
      ? [...group.sido.born.map((n) => `${n} 신설`), ...group.sido.renamed]
      : []),
    ...(group.sigungu
      ? [
          ...(group.sigungu.born.length ? [`${group.sigungu.born.join(", ")} 생김`] : []),
          ...(group.sigungu.gone.length ? [`${group.sigungu.gone.join(", ")} 사라짐`] : []),
        ]
      : []),
  ].join(" · ");

  events.push({
    year,
    headline,
    before: {
      year: prevYear,
      regions: prevIn.map(shape),
      marked: prevIn.filter((f) => goneSet.has(codeOf(f))).map(codeOf),
    },
    after: {
      year,
      regions: nowIn.map(shape),
      marked: nowIn.filter((f) => bornSet.has(codeOf(f))).map(codeOf),
    },
  });
  process.stdout.write(`  ${prevYear}→${year} · ${level} · ${nowIn.length}곳\n`);
}

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

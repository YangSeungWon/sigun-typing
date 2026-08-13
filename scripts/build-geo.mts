/**
 * 코스별 지도 데이터를 만든다.  실행: `npm run build:geo`
 *
 * 핵심 결정: SVG path 문자열을 **빌드 시점에 미리 계산해** 커밋한다.
 * 그래서 런타임에는 d3-geo도 topojson도 필요 없고, 브라우저는 <path d="...">만
 * 그리면 된다. 좌표를 소수점 한 자리로 반올림하므로 결과 파일도 작다.
 *
 * 원본은 통계청 SGIS 행정구역경계(2025)다. 원본 스키마(SIG_KOR_NM 등)를 아는 곳은
 * 이 파일뿐이고, 게임 쪽에는 정규화된 형태만 넘어간다.
 *
 * 코스 목록을 여기 적어 두지 않는다. data/courses/ 에 파일을 하나 떨구면
 * 그대로 잡히므로, 지역을 늘리는 일이 개발이 아니라 데이터 작업이 된다.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator, geoPath } from "d3-geo";
import type { MultiPolygon as GeoJsonMultiPolygon } from "geojson";
import polylabel from "polylabel";
import { feature, merge } from "topojson-client";
import type {
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Topology,
} from "topojson-specification";
import type { Course, Region } from "../data/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "data/geo/source");
const COURSE_DIR = join(ROOT, "data/courses");
const OUT_DIR = join(ROOT, "data/geo");

const SOURCES = {
  provinces: "korea-sido.json",
  municipalities: "korea-sigungu.json",
} as const;

const BASE_URL =
  "https://raw.githubusercontent.com/YangSeungWon/quiz-korea/main/public/data";

/** SGIS 원본 필드명. 시도 파일과 시군구 파일이 서로 다른 이름을 쓴다. */
interface RegionProps {
  CTPRVN_CD?: string;
  CTP_KOR_NM?: string;
  SIG_CD?: string;
  SIG_KOR_NM?: string;
}

type Area = Polygon<RegionProps> | MultiPolygon<RegionProps>;

/** 원본의 제각각인 필드명을 여기서 한 번만 정규화한다. */
function propsOf(g: Area): { code: string; name: string } {
  const p = g.properties!;
  const code = p.SIG_CD ?? p.CTPRVN_CD;
  const name = p.SIG_KOR_NM ?? p.CTP_KOR_NM;
  if (!code || !name) {
    throw new Error(`코드나 이름이 없는 경계: ${JSON.stringify(p)}`);
  }
  return { code, name };
}

/** 원본에는 빈 도형(NullObject)이 섞여 있을 수 있어 면만 걸러낸다. */
function isArea(g: { type: string | null }): g is Area {
  return g.type === "Polygon" || g.type === "MultiPolygon";
}

type Ring = [number, number][];
/** [바깥 링, ...구멍] */
type ProjectedPolygon = Ring[];

function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/** 홀수 교차 판정. 링을 전부 세므로 구멍도 자연히 처리된다. */
function pointInPolygon(x: number, y: number, polygon: ProjectedPolygon): boolean {
  let inside = false;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * 라벨 위치를 무게중심이 아니라 **내접원 중심(pole of inaccessibility)**으로 잡는다.
 *
 * 무게중심은 도형이 오목하거나(해안 시군) 섬이 딸려 있으면 도형 바깥에 찍힌다.
 * 안산시가 대부도를 안고 있는 경우처럼 육지와 섬 사이 바다에 라벨이 놓이는 식이다.
 */
function labelPoint(polygons: ProjectedPolygon[]): [number, number] {
  const largest = polygons.reduce((best, p) =>
    ringArea(p[0]) > ringArea(best[0]) ? p : best,
  );
  const [x, y] = polylabel(largest, 0.5);
  return [x, y];
}

/**
 * 단순화 비율. 위상(topology)을 지키므로 인접한 지역의 맞닿은 경계가 갈라져
 * 실틈이 생기지 않는다.
 *
 * **코스 범위로 잘라낸 뒤에** 단순화하는 것이 중요하다. Visvalingam은 삼각형
 * 넓이로 정점의 중요도를 매기는데, 전국을 한꺼번에 걸면 작은 도시 구역의
 * 정점은 절대 넓이가 작아 언제나 먼저 잘려 나간다. 실제로 전국 기준 4%로
 * 돌렸을 때 금천구가 4점짜리 사각형이 됐다.
 *
 * 같은 이유로 도시 코스는 값이 넉넉해야 한다. 12%에서는 부산 중구(전국에서
 * 가장 작은 자치구)가 6점으로 뭉개졌다. 20%면 부산 최소 11점 · 서울 16점으로
 * MIN_VERTICES 위에 여유가 남는다.
 */
const SIMPLIFY_PERCENT = 20;

/** 이보다 단순해지면 지역의 모양을 알아볼 수 없다. */
const MIN_VERTICES = 8;

/**
 * 썸네일 경계선용 축약 비율.
 *
 * 카드에서 이 선이 하는 말은 "여기가 여러 곳으로 나뉜다"뿐이다. 128px에
 * 그리는 선이므로 코스 지도만큼 정확할 이유가 없고, 얇은 선은 점이 많을수록
 * 오히려 지저분해진다.
 */
const THUMB_PERCENT = 5;

async function simplify(
  file: string,
  out: string,
  prefix: string | undefined,
  percent: number,
) {
  const mapshaper = (await import("mapshaper")).default;
  // 접두사로 먼저 걸러 코스 안에서만 중요도를 겨룬다.
  const filter = prefix
    ? `-filter "(SIG_CD || CTPRVN_CD || '').indexOf('${prefix}') === 0" `
    : "";
  /*
   * 축약 전에 한 번 씻는다(`-clean`).
   *
   * 원본은 지역마다 좌표를 따로 들고 있어서, 맞닿아야 할 두 경계가 소수점
   * 아래에서 어긋나 있는 자리가 있다. 그대로 위상을 만들면 그 자리는 공유
   * 경계가 아니라 **서로 다른 두 선**이 되고, 축약도 따로 걸려 벌어진다.
   * 붙여야 할 것을 먼저 붙여 놓아야 그 뒤가 전부 한 벌로 움직인다.
   *
   * 축약은 그 위상 위에서 돈다 — 공유 경계는 한 번만 줄어들고 양쪽이 같은
   * 결과를 쓴다. 이게 지역마다 따로 simplify하면 안 되는 이유다.
   */
  const result = await mapshaper.applyCommands(
    `-i input.json ${filter}-clean ` +
      `-simplify visvalingam ${percent}% keep-shapes ` +
      `-o output.json format=topojson`,
    { "input.json": await readFile(file) },
  );
  await writeFile(out, Buffer.from(result["output.json"]));
}

/**
 * 경계선만 뽑아낸다(`-innerlines`).
 *
 * 지역 도형을 그대로 그리면 맞닿은 경계가 **양쪽에서 한 번씩, 두 겹으로**
 * 그려진다. 데이터가 두 배가 되는 것은 물론이고, 옅은 선으로 깔면 안쪽만
 * 진해져 바깥 윤곽과 세기가 달라진다.
 *
 * innerlines는 공유 경계를 한 줄로 준다. 바깥 윤곽은 이미 실루엣이 그리므로
 * 여기 없어도 된다 — 카드에 필요한 것은 "안이 나뉘어 있다"는 사실뿐이다.
 */
async function extractInnerLines(
  file: string,
  out: string,
  prefix: string | undefined,
  percent: number,
) {
  const mapshaper = (await import("mapshaper")).default;
  const filter = prefix
    ? `-filter "(SIG_CD || CTPRVN_CD || '').indexOf('${prefix}') === 0" `
    : "";
  const result = await mapshaper.applyCommands(
    `-i input.json ${filter}-clean ` +
      `-simplify visvalingam ${percent}% keep-shapes ` +
      `-innerlines -o output.json format=topojson`,
    { "input.json": await readFile(file) },
  );
  await writeFile(out, Buffer.from(result["output.json"]));
}

const topologyCache = new Map<string, Topology>();

async function loadTopology(
  key: keyof typeof SOURCES,
  prefix: string | undefined,
  percent: number,
  /** 면 대신 경계선만. 썸네일에 얹을 선을 뽑을 때 쓴다. */
  lines = false,
): Promise<Topology> {
  const cacheKey = `${key}:${prefix ?? "all"}:${percent}:${lines ? "lines" : "areas"}`;
  const cached = topologyCache.get(cacheKey);
  if (cached) return cached;

  await mkdir(SOURCE_DIR, { recursive: true });
  const file = join(SOURCE_DIR, SOURCES[key]);
  if (!existsSync(file)) {
    const url = `${BASE_URL}/${SOURCES[key]}`;
    process.stdout.write(`내려받는 중 ${url}\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} 내려받기 실패: ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }

  const simplified = file.replace(
    /\.json$/,
    `.${prefix ?? "all"}-${percent}${lines ? ".lines" : ""}.clean.json`,
  );
  if (!existsSync(simplified)) {
    await (lines ? extractInnerLines : simplify)(file, simplified, prefix, percent);
  }

  const topology = JSON.parse(await readFile(simplified, "utf8")) as Topology;
  topologyCache.set(cacheKey, topology);
  return topology;
}

/**
 * 원본 경계 하나가 이 지역의 것인가.
 *
 * 행정계층을 따지지 않는 하나의 규칙이다. 표준 표기와 별칭 중 하나와
 * 정확히 같거나(`종로구`, `서울특별시`, `철원군`), 그것으로 시작하는
 * 하위 구역이면(`수원시 장안구`) 이 지역에 속한다.
 *
 * 접두사 뒤에 공백을 요구하는 것이 중요하다. 그냥 startsWith로 하면
 * `강남구`가 `강남`으로 시작한다는 이유로 엉뚱하게 빨려 들어간다.
 */
function belongsTo(region: Region, sourceName: string): boolean {
  const candidates = [region.name, ...(region.aliases ?? [])];
  return candidates.some(
    (c) => sourceName === c || sourceName.startsWith(`${c} `),
  );
}

/** data/courses/ 에 있는 코스를 전부 읽어 온다. 파일을 넣으면 그것으로 끝이다. */
async function loadCourses(): Promise<Course[]> {
  const files = (await readdir(COURSE_DIR))
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => f !== "index.ts" && !f.endsWith(".test.ts"))
    .sort();

  const courses: Course[] = [];
  for (const file of files) {
    const mod = await import(join(COURSE_DIR, file));
    for (const value of Object.values(mod)) {
      const course = value as Course;
      if (course && typeof course === "object" && "id" in course && "regions" in course) {
        courses.push(course);
      }
    }
  }
  return courses.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 코스별 외곽선. 썸네일(`npm run build:thumbs`)이 쓴다.
 *
 * 코스 지도(`<id>.json`)에 같이 넣지 않는 이유: 그 파일은 플레이 화면이
 * 통째로 읽는데, 외곽선은 거기서 한 번도 쓰이지 않는다.
 */
const outlines: Record<string, { outline: string; borders: string }> = {};

interface Report {
  course: string;
  places: number;
  geometries: number;
  unmatched: string[];
  duplicated: string[];
  orphans: string[];
  /** 원본 조각을 둘 이상 합친 장소. 시 아래 구가 있을 때만 정상이다. */
  merged: string[];
}

/**
 * 지역 코드 앞 두 자리(행정표준코드) → 원본 경계 파일의 옛 시도 코드.
 *
 * 원본과 우리 데이터가 서로 다른 코드 체계를 쓴다. 부산은 우리 쪽에서 `26`인데
 * 원본에서는 `21`이다. 그래서 경계를 코드로 맞출 수 없고 이름으로 맞춰 왔다.
 *
 * 한 시도 안에서는 이름이 유일하므로 그걸로 충분했다. 전국 시군구 코스는
 * 접두사가 없어 온 나라의 경계가 한 통에 들어오고, 거기서는 `중구`가 여섯
 * 개다. 지역마다 자기 시도로 통을 좁혀 주면 다시 유일해진다.
 *
 * 대응표는 코스들이 이미 갖고 있다 — 시군구 코스마다 옛 접두사(geo.prefix)와
 * 지역 코드(현행)를 둘 다 들고 있으므로 여기서 짝지어 읽기만 하면 된다.
 */
function legacyPrefixes(all: Course[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of all) {
    if (c.geo?.file !== "municipalities" || !c.geo.prefix) continue;
    map.set(c.regions[0].code.slice(0, 2), c.geo.prefix);
  }
  return map;
}

type Loaded = Awaited<ReturnType<typeof loadTopology>>;

/** 원본 한 조각과, 그것이 나온 위상. 조각을 합칠 때 같은 위상이어야 한다. */
interface Piece {
  geom: Area;
  topology: Loaded;
  code: string;
  name: string;
}

/**
 * 이 코스가 쓸 원본 조각들.
 *
 * 한 통에서만 꺼낸다. 시도마다 따로 축약해 모으는 안도 있었지만, 그러면 시도
 * 경계가 양쪽에서 다르게 줄어들어 실루엣에 이음매가 생긴다 — 이 파일이
 * 지역별로 축약하지 않는 이유와 같다.
 *
 * 전국을 한꺼번에 축약해도 작은 자치구가 살아남는지가 걱정이었는데, 재 보니
 * 20%에서 가장 작은 도형(중구)도 15점을 남긴다. 뭉개지던 원인은 축약이 아니라
 * **좌표 반올림**이었다(PRECISION 참조).
 */
async function poolFor(course: Course): Promise<Piece[]> {
  const source = course.geo!;
  const percent = source.simplifyPercent ?? SIMPLIFY_PERCENT;

  const load = async (prefix: string | undefined): Promise<Piece[]> => {
    const topology = await loadTopology(source.file, prefix, percent);
    const objectKey = Object.keys(topology.objects)[0];
    const collection = topology.objects[objectKey] as GeometryCollection<RegionProps>;
    return collection.geometries
      .filter(isArea)
      .map((geom) => ({ geom, topology, ...propsOf(geom) }))
      .filter((piece) => !prefix || piece.code.startsWith(prefix));
  };

  return load(source.prefix);
}

async function buildCourse(course: Course, legacy: Map<string, string>): Promise<Report> {
  const source = course.geo!;
  const pool = await poolFor(course);

  const unmatched: string[] = [];
  const features = course.regions.map((region) => {
    /*
     * 접두사로 통을 좁혀 두지 않은 코스(전국 시군구)에서는 지역마다 자기
     * 시도로 좁힌다. 그러지 않으면 `중구`가 여섯 조각을 한꺼번에 물어 온다.
     */
    const scope = source.prefix ? undefined : legacy.get(region.code.slice(0, 2));
    const candidates = scope ? pool.filter((p) => p.code.startsWith(scope)) : pool;
    const parts = candidates.filter((p) => belongsTo(region, p.name));
    if (parts.length === 0) unmatched.push(region.name);
    return {
      region,
      sources: parts.map((p) => ({ code: p.code, name: p.name })),
      // 합치는 것은 같은 위상 안에서만. 한 지역의 조각들은 늘 한 시도에서 온다.
      geometry:
        parts.length > 0 ? merge(parts[0].topology, parts.map((p) => p.geom)) : null,
    };
  });

  /*
   * 한 원본 조각이 두 지역에 동시에 들어가면 매칭 규칙이 잘못된 것이다.
   *
   * **코드**로 센다. 이름으로 세면 전국 코스에서 서울 중구와 부산 중구가 같은
   * 조각으로 잡혀, 멀쩡히 나뉜 것을 중복이라고 신고한다.
   */
  const used = features.flatMap((f) => f.sources);
  const usedCodes = used.map((u) => u.code);
  const duplicated = [
    ...new Set(
      used.filter((u, i) => usedCodes.indexOf(u.code) !== i).map((u) => u.name),
    ),
  ];

  // 아무 지역도 가져가지 않은 원본 — 코스에 빠진 지역이 있다는 뜻이다.
  const claimed = new Set(usedCodes);
  const orphans = pool
    .filter((p) => !claimed.has(p.code))
    .map((p) => p.name);

  const report: Report = {
    course: course.id,
    places: course.regions.length,
    geometries: features.filter((f) => f.geometry).length,
    unmatched,
    duplicated,
    orphans,
    merged: features.filter((f) => f.sources.length > 1).map((f) => f.region.name),
  };

  if (unmatched.length || duplicated.length || orphans.length) return report;

  // 코스 전체를 담는 투영을 먼저 잡고, 실제 그려지는 범위에 딱 맞춰 자른다.
  const all = {
    type: "FeatureCollection" as const,
    features: features.map((f) => ({
      type: "Feature" as const,
      properties: {},
      geometry: f.geometry!,
    })),
  };

  const PAD = 12;
  const projection = geoMercator().fitExtent(
    [
      [PAD, PAD],
      [1000 - PAD, 1000 - PAD],
    ],
    all,
  );
  /*
   * 좌표 소수점 자리.
   *
   * 1000px 판에 지역 스물다섯 개를 그릴 때는 한 자리면 넘친다 — 0.1px보다
   * 작은 차이는 화면에 없다. 전국 시군구는 다르다. 대구 중구는 온 나라를
   * 1000px에 담았을 때 14px짜리이고, 그 안의 열다섯 점이 한 자리 반올림에서
   * 여섯 점으로 뭉친다. 실제로 그 때문에 축약 비율을 올려도 소용이 없었다.
   *
   * 게다가 플레이 화면은 이 좌표를 그대로 확대해서 쓴다. 그러니 뭉친 점은
   * 작게 보일 때만 괜찮은 것이 아니라 크게 볼 때 육각형으로 남는다.
   *
   * 지역이 많을수록 한 지역이 차지하는 자리가 작아지므로 자리를 하나 더 준다.
   * 파일은 그만큼 커지지만, 이 코스는 원래 큰 코스다.
   */
  const path = geoPath(projection).digits(course.regions.length > 60 ? 2 : 1);

  const [[x0, y0], [x1, y1]] = path.bounds(all);
  projection.translate([
    projection.translate()[0] - x0 + PAD,
    projection.translate()[1] - y0 + PAD,
  ]);

  const width = Math.ceil(x1 - x0 + PAD * 2);
  const height = Math.ceil(y1 - y0 + PAD * 2);
  const project = (p: number[]) => projection([p[0], p[1]]) ?? [NaN, NaN];

  const regions = features.map((f) => {
    const feature = { type: "Feature" as const, properties: {}, geometry: f.geometry! };
    const geometry = f.geometry as GeoJsonMultiPolygon;

    // 화면 좌표에서 라벨을 잡아야 실제로 보이는 모양의 안쪽에 놓인다.
    const polygons: ProjectedPolygon[] = geometry.coordinates.map((rings) =>
      rings.map((ring) => ring.map(project) as Ring),
    );
    const [cx, cy] = labelPoint(polygons);
    if (!polygons.some((p) => pointInPolygon(cx, cy, p))) {
      throw new Error(`${course.id}: '${f.region.name}' 라벨이 도형 바깥에 놓였습니다`);
    }

    const d = path(feature)!;
    const vertices = (d.match(/[ML]/g) ?? []).length;
    if (vertices < MIN_VERTICES) {
      throw new Error(
        `${course.id}: '${f.region.name}'이 ${vertices}점으로 뭉개졌습니다 — 단순화 비율을 올리세요`,
      );
    }

    return {
      code: f.region.code,
      name: f.region.name,
      d,
      cx: Math.round(cx * 10) / 10,
      cy: Math.round(cy * 10) / 10,
    };
  });

  /*
   * 코스 하나를 통째로 합친 외곽선.
   *
   * 카드 썸네일이 그리는 것은 "지역 스물다섯 개"가 아니라 **코스 하나의
   * 실루엣**이다. 그런데 지금까지는 지역별 도형을 각각 솎아 겹쳐 그렸다.
   * 맞닿은 두 지역이 서로 다른 점을 남기니 공유 경계가 어긋났고, 내부 선을
   * 안 그리는 실루엣에서 그 어긋남이 삐죽한 홈으로 남았다.
   *
   * 위상은 여기 있으므로 합치는 것은 merge 한 번이다. 내부 경계가 사라지면
   * 어긋날 경계 자체가 없고, 점 수도 크게 준다.
   */
  /*
   * 실루엣은 늘 한 자리로 족하다. 카드 썸네일에서만 쓰이고 확대되지 않으므로
   * 지역 도형에 준 여유(PRECISION 주석)를 여기까지 끌고 오면 파일만 커진다 —
   * 전국 코스에서 outlines.json이 그것 때문에 네 배가 됐다.
   */
  const outlinePath = geoPath(projection).digits(1);
  const outline = outlinePath({
    type: "Feature" as const,
    properties: {},
    // pool은 한 위상에서만 나온다(poolFor 참조). 조각에 실려 온 것을 그대로 쓴다.
    geometry: merge(pool[0].topology, pool.map((p) => p.geom)),
  })!;

  /*
   * 썸네일에 얹을 지역 경계.
   *
   * 코스 지도의 경계를 그대로 쓰면 카드 한 장에 수천 점이 실린다. 그렇다고
   * 지역마다 몇 번째 점만 남기는 식으로 솎으면, 맞닿은 두 지역이 서로 다른
   * 점을 남겨 같은 경계가 두 줄로 갈라진다 — 카드에서 선이 얼기설기해 보이던
   * 것이 이것이다. 격자에 붙이면 갈라지지는 않지만 계단처럼 각진다.
   *
   * 답은 처음부터 여기 있었다. **위상을 지킨 채 더 세게 축약한 판**을 한 벌
   * 더 만든다. 공유 경계는 한 번만 줄어들고 양쪽이 같은 결과를 쓴다.
   */
  const lines = await loadTopology(source.file, source.prefix, THUMB_PERCENT, true);
  const lineKey = Object.keys(lines.objects)[0];
  const borders = path(feature(lines, lines.objects[lineKey])) ?? "";

  const out = { id: course.id, width, height, regions };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, `${course.id}.json`), JSON.stringify(out));
  outlines[course.id] = { outline, borders };

  const kb = (JSON.stringify(out).length / 1024).toFixed(0);
  process.stdout.write(
    `  ${width}×${height}  ${kb}KB\n`,
  );
  return report;
}

function printReport(r: Report): boolean {
  const ok = !r.unmatched.length && !r.duplicated.length && !r.orphans.length;
  process.stdout.write(
    `${ok ? "PASS" : "FAIL"}  ${r.course.padEnd(10)} ` +
      `장소 ${r.places} · 경계 ${r.geometries} · ` +
      `미매칭 ${r.unmatched.length} · 중복 ${r.duplicated.length} · ` +
      `남은 원본 ${r.orphans.length} · 병합 ${r.merged.length}\n`,
  );
  if (r.unmatched.length) process.stdout.write(`      경계 없음: ${r.unmatched.join(", ")}\n`);
  if (r.duplicated.length) process.stdout.write(`      중복 매칭: ${r.duplicated.join(", ")}\n`);
  if (r.orphans.length) process.stdout.write(`      코스에 빠짐: ${r.orphans.join(", ")}\n`);
  if (r.merged.length) process.stdout.write(`      합쳐진 장소: ${r.merged.join(", ")}\n`);
  return ok;
}

const courses = (await loadCourses()).filter((c) => c.geo);
const legacy = legacyPrefixes(courses);
let allOk = true;
for (const course of courses) {
  const report = await buildCourse(course, legacy);
  if (!printReport(report)) allOk = false;
}

if (!allOk) {
  process.stderr.write("\n지도 데이터를 만들지 못했습니다.\n");
  process.exit(1);
}

/*
 * 코스 지도 폴더 **밖에** 쓴다. 안에 두면 `./*.json`을 훑는 코드가 이 파일을
 * 코스 지도로 집는다 — 실제로 지도 검사 여섯 개가 그렇게 깨진 적이 있다.
 */
await writeFile(join(ROOT, "data/outlines.json"), `${JSON.stringify(outlines)}\n`);
process.stdout.write(
  `외곽선 ${Object.keys(outlines).length}개 · ` +
    `${Math.round(JSON.stringify(outlines).length / 1024)}KB\n`,
);

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
  dong: "korea-dong.json",
} as const;

const BASE_URL =
  "https://raw.githubusercontent.com/YangSeungWon/quiz-korea/main/public/data";

/**
 * SGIS 원본에서 직접 만들어야 하는 층.
 *
 * 시도·시군구는 미리 TopoJSON으로 다듬어 둔 것을 BASE_URL에서 받는다.
 * 읍면동은 그런 것이 없어 통계청 자료를 신청해 받은 SHP에서 만든다 —
 * `data/geo/source/sgis/`에 zip을 두면 아래에서 꺼내 쓴다.
 */
const SGIS_LEVELS: Partial<Record<keyof typeof SOURCES, string>> = {
  dong: "bnd_dong",
};

/** SGIS 원본이 사는 곳. 신청이 필요해 자동으로 받지 못한다. */
const SGIS_DIR = join(ROOT, "data/geo/source/sgis");

/**
 * 물길 원본이 사는 곳.
 *
 * OpenStreetMap을 Geofabrik이 SHP으로 말아 둔 것이다(`south-korea-free.shp.zip`).
 * 신청이 없어 바로 받을 수 있고 좌표계도 이미 WGS84라 변환이 필요 없다.
 *
 * **라이선스가 SGIS와 다르다.** OSM은 ODbL이라 표시가 의무다. 다만 여기서
 * 굽는 것은 화면 좌표로 투영해 소수점 한 자리로 반올림한 path라 — 지리
 * 좌표가 아니라 픽셀이고 속성도 하나 안 실린다 — 산출물(Produced Work)에
 * 가깝고, 그러면 동일조건은 붙지 않는다. 이름 같은 속성을 싣기 시작하면
 * 그 판단이 달라진다.
 */
const OSM_DIR = join(ROOT, "data/geo/source/osm");
const OSM_ZIP = "south-korea-free.shp.zip";

/**
 * 얹을 물길.
 *
 * 실개천까지 다 얹으면 지도가 실타래가 된다. 강과 그만한 것만 남긴다.
 * `water_a`는 면(호수·저수지·넓은 강), `waterways`는 선(강줄기)이다.
 */
const WATER_KINDS = ["river", "canal"];

/**
 * 물길도 지역 도형만큼 깎는다.
 *
 * OSM은 손으로 그린 자료라 강기슭이 지역 경계보다 훨씬 촘촘하다. 안 깎으면
 * 서울 한 코스가 387KB가 된다 — 지역 도형 8KB 옆에서 물이 파일의 전부가 된다.
 */
const WATER_RESOLUTION = "1400x1400";

/**
 * 이보다 작게 그려지는 물은 버린다(픽셀).
 *
 * 연못까지 남기면 서울에만 면이 920조각이다. 1000px 판에서 몇 픽셀짜리 점은
 * 물로 보이지도 않는다 — 얹는 뜻이 "이 동네에 강이 흐른다"인데 티끌은 그
 * 말을 하지 않는다.
 */
const WATER_MIN_PX = 6;

/**
 * 전국 지도에서는 **길게 그려지는 강만** 남긴다(픽셀).
 *
 * 전부 얹으면 실타래가 되지만, 한강·낙동강·금강·영산강은 전국 축척에서도
 * 지리를 설명한다 — 어느 도가 어느 강을 끼고 있는지는 그 자체로 읽을거리다.
 * `fclass=river`만으로는 못 가른다. 짧은 지방 하천도 river이므로, 그려 놓고
 * 길이로 자른다.
 */
const WATER_TRUNK_PX = 120;

/**
 * 고도 띠가 사는 곳. `npm run build:terrain`이 채운다.
 *
 * SRTM 1초(약 30m). AWS 공개 자료라 신청도 키도 없고, `.hgt`는 빅엔디언
 * 16비트 정수를 늘어놓은 것뿐이라 읽는 데 아무것도 필요 없다.
 */
const DEM_DIR = join(ROOT, "data/geo/source/dem");
const DEM_SIDE = 3601;

/**
 * 고도를 나누는 자리(m).
 *
 * 넷이면 족하다 — 평야·구릉·산지·고산. 더 잘게 나누면 지도가 시끄러워지고,
 * 이 지도가 하려는 말은 "여기가 산이다"이지 등고선 읽기가 아니다.
 */
const TERRAIN_BANDS = [100, 300, 700];

/**
 * 격자를 몇 픽셀마다 뜰 것인가.
 *
 * 촘촘할수록 곱지만 파일이 커진다. 등고선은 격자를 따라 계단처럼 나오므로,
 * 이 값이 작을수록 계단이 잘아지고 점이 기하급수로 는다. 3으로 뜨니 강원
 * 한 코스가 535KB였다.
 */
const TERRAIN_STEP = 5;

/** 등고선을 얼마나 무디게 할 것인가. 격자 칸 단위다. */
const TERRAIN_INTERVAL = 0.7;

/** 이보다 작은 얼룩은 버린다. 격자 칸 넓이 단위다. */
const TERRAIN_MIN_AREA = 6;

/*
 * 바다는 따로 걸러 내지 않는다.
 *
 * 크기로 걸러 봤더니 그 잣대가 **한강까지 죽였다** — 한강 폴리곤은 강원부터
 * 김포까지라 서울 판에 투영하면 양방향으로 판을 넘는다. 겉보기 크기로는
 * 바다와 강을 못 가른다.
 *
 * 아래에서 땅 모양으로 잘라 내므로 바다는 저절로 사라진다. 땅과 안 겹친다.
 */

/**
 * 원본 필드명. **출처마다, 그리고 해마다 다르다.**
 *
 * 시도·시군구는 대문자 `CTPRVN_CD`/`SIG_CD`를 쓰고, SGIS 읍면동은
 * `ADM_CD`/`ADM_NM`이다. 같은 SGIS 안에서도 1975년판은 소문자
 * (`adm_dr_cd`)라, 여기 적힌 것은 지금 쓰는 2025년판 기준이다.
 */
interface RegionProps {
  CTPRVN_CD?: string;
  CTP_KOR_NM?: string;
  SIG_CD?: string;
  SIG_KOR_NM?: string;
  ADM_CD?: string;
  ADM_NM?: string;
}

type Area = Polygon<RegionProps> | MultiPolygon<RegionProps>;

/** 원본의 제각각인 필드명을 여기서 한 번만 정규화한다. */
function propsOf(g: Area): { code: string; name: string } {
  const p = g.properties!;
  const code = p.SIG_CD ?? p.CTPRVN_CD ?? p.ADM_CD;
  const name = p.SIG_KOR_NM ?? p.CTP_KOR_NM ?? p.ADM_NM;
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

/**
 * SGIS 원본은 **비율이 아니라 해상도로** 깎는다.
 *
 * 위의 20%는 이미 다듬어진 원본(korea-sido/sigungu.json)에 맞춘 값이다.
 * 읍면동은 통계청 SHP에서 직접 만들어 백 배쯤 촘촘하고, 같은 20%를 걸면
 * 태안군 한 코스가 580KB가 된다 — 그리는 판은 1000px인데.
 *
 * 해상도로 걸면 "이 크기의 화면에 필요한 만큼"만 남아, 서울 자치구든 섬이
 * 흩어진 해안 군이든 고르게 나온다.
 */
const SGIS_RESOLUTION = "1400x1400";

/** 이 원본을 어떻게 깎을지. mapshaper의 `-simplify` 인자로 그대로 들어간다. */
function simplifySpec(key: keyof typeof SOURCES, percent: number): string {
  return SGIS_LEVELS[key] ? `resolution=${SGIS_RESOLUTION}` : `${percent}%`;
}

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
  spec: string,
) {
  const mapshaper = (await import("mapshaper")).default;
  // 접두사로 먼저 걸러 코스 안에서만 중요도를 겨룬다.
  const filter = prefix
    ? `-filter "(this.properties.SIG_CD || this.properties.CTPRVN_CD || this.properties.ADM_CD || '').indexOf('${prefix}') === 0" `
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
      `-simplify visvalingam ${spec} keep-shapes ` +
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
  spec: string,
) {
  const mapshaper = (await import("mapshaper")).default;
  const filter = prefix
    ? `-filter "(this.properties.SIG_CD || this.properties.CTPRVN_CD || this.properties.ADM_CD || '').indexOf('${prefix}') === 0" `
    : "";
  const result = await mapshaper.applyCommands(
    `-i input.json ${filter}-clean ` +
      `-simplify visvalingam ${spec} keep-shapes ` +
      `-innerlines -o output.json format=topojson`,
    { "input.json": await readFile(file) },
  );
  await writeFile(out, Buffer.from(result["output.json"]));
}

/**
 * SGIS SHP에서 원본 TopoJSON을 만든다.
 *
 * 두 가지를 여기서 흡수한다.
 *
 * **좌표계.** SGIS는 UTM-K(EPSG:5179) 미터 좌표다. 그대로 두면 지도가 아니라
 * 백만 단위 숫자 덩어리라 d3가 못 그린다. `.prj`가 든 해도 있고 안 든 해도
 * 있어서 원본을 믿지 않고 `from=`으로 못 박는다.
 *
 * **zip 속의 zip.** 한 해치 파일 안에 시도·시군구·읍면동 세 겹이 또 zip으로
 * 들어 있다. 필요한 하나만 꺼낸다.
 */
async function buildFromSgis(level: string, out: string): Promise<void> {
  const zips = (await readdir(SGIS_DIR).catch(() => []))
    .filter((f) => f.startsWith("bnd_all") && f.endsWith(".zip"))
    .sort();
  if (zips.length === 0) {
    throw new Error(
      `${SGIS_DIR}에 원본이 없다.\n` +
        "SGIS(sgis.mods.go.kr) 자료제공에서 센서스용 행정구역경계를 신청해 받은 뒤\n" +
        "bnd_all_00_<연도>_<분기>Q.zip 을 그 폴더에 둔다.",
    );
  }
  // 가장 최신 시점을 쓴다. 이름이 연도순이라 마지막이 그것이다.
  const newest = zips[zips.length - 1];
  process.stdout.write(`SGIS에서 만드는 중 ${newest} → ${level}\n`);

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const run = promisify(execFile);

  const dir = await mkdtemp(join(tmpdir(), "sgis-geo-"));
  try {
    await run("unzip", ["-q", "-o", join(SGIS_DIR, newest), `${level}_*`, "-d", dir]);
    const inner = (await readdir(dir)).find((f) => f.endsWith(".zip"));
    if (!inner) throw new Error(`${newest}: ${level} 없음`);
    await run("unzip", ["-q", "-o", join(dir, inner), "-d", dir]);

    // 파일 이름 규칙이 해마다 다르다(BND_SIDO_PG_2014 / bnd_dong_00_2025_2Q).
    const base = (await readdir(dir)).find((f) => f.endsWith(".shp"))?.replace(/\.shp$/, "");
    if (!base) throw new Error(`${newest}: shp 없음`);

    const mapshaper = (await import("mapshaper")).default;
    const result = await mapshaper.applyCommands(
      "-i in.shp -proj from=EPSG:5179 wgs84 -o out.json format=topojson",
      {
        "in.shp": await readFile(join(dir, `${base}.shp`)),
        "in.dbf": await readFile(join(dir, `${base}.dbf`)),
      },
    );
    await writeFile(out, Buffer.from(result["out.json"]));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * 큰 원본을 시군구별로 한 번에 쪼갠다.
 *
 * 읍면동만 해당한다. 시도·시군구 원본은 작아서 코스마다 걸러도 표가 안 나지만,
 * 읍면동은 57MB짜리 한 벌에 252개 코스가 달라붙는다.
 *
 * mapshaper의 `-split`이 한 번에 다 만들어 준다. 쪼갤 기준(앞 다섯 자리)을
 * 필드로 하나 붙여 두고 그것으로 가른다.
 */
const sliced = new Set<string>();
async function sliceFor(
  key: keyof typeof SOURCES,
  prefix: string,
  file: string,
): Promise<string> {
  if (!SGIS_LEVELS[key]) return file;

  const target = file.replace(/\.json$/, `.slice-${prefix}.json`);
  if (existsSync(target)) return target;
  // 한 번 쪼갰는데도 없으면 그 접두사에 해당하는 원본이 없는 것이다.
  if (sliced.has(key)) return file;

  process.stdout.write(`원본을 시군구별로 쪼개는 중 ${SOURCES[key]}\n`);

  /*
   * mapshaper의 `-split`에 맡기지 않는다. 출력 파일 이름을 그쪽이 정하는데
   * 규칙이 짐작과 달라 한 장도 못 건졌다. 여기서 직접 가른다.
   *
   * 도형은 GeoJSON으로 펴서 내보낸다. TopoJSON은 조각들이 arc를 공유하므로
   * 잘라 내면 참조가 깨진다 — 펴 두면 조각마다 독립이고, 위상은 어차피
   * 코스마다 `-clean`이 다시 세운다.
   */
  const topo = JSON.parse(await readFile(file, "utf8")) as Topology;
  const objectKey = Object.keys(topo.objects)[0];
  const fc = feature(
    topo,
    topo.objects[objectKey] as GeometryCollection<RegionProps>,
  ) as unknown as { features: { properties: RegionProps }[] };

  const groups = new Map<string, unknown[]>();
  for (const f of fc.features) {
    const code = f.properties?.ADM_CD ?? "";
    if (code.length < 5) continue;
    const head = code.slice(0, 5);
    if (!groups.has(head)) groups.set(head, []);
    groups.get(head)!.push(f);
  }

  for (const [code, features] of groups) {
    await writeFile(
      file.replace(/\.json$/, `.slice-${code}.json`),
      JSON.stringify({ type: "FeatureCollection", features }),
    );
  }
  sliced.add(key);
  process.stdout.write(`  ${groups.size}개로 나눔\n`);
  return existsSync(target) ? target : file;
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
    const level = SGIS_LEVELS[key];
    if (level) {
      await buildFromSgis(level, file);
    } else {
      const url = `${BASE_URL}/${SOURCES[key]}`;
      process.stdout.write(`내려받는 중 ${url}\n`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} 내려받기 실패: ${res.status}`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
    }
  }

  /*
   * 읍면동은 코스마다 원본을 다시 훑으면 안 된다.
   *
   * 전국 읍면동 원본이 57MB인데 코스가 252개다. 코스마다 이 파일을 걸러
   * 축약하면 한 코스에 30초씩, 전부 두 시간이 넘는다. 시군구별로 한 번만
   * 쪼개 두면 그 뒤로는 각자 작은 파일만 만진다.
   */
  const source = prefix ? await sliceFor(key, prefix, file) : file;

  const simplified = file.replace(
    /\.json$/,
    `.${prefix ?? "all"}-${percent}${lines ? ".lines" : ""}.clean.json`,
  );
  if (!existsSync(simplified)) {
    await (lines ? extractInnerLines : simplify)(
      source,
      simplified,
      // 이미 잘라 둔 조각이면 다시 거를 것이 없다.
      source === file ? prefix : undefined,
      simplifySpec(key, percent),
    );
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

  const isCourse = (v: unknown): v is Course =>
    !!v && typeof v === "object" && "id" in v && "regions" in v;

  const courses: Course[] = [];
  for (const file of files) {
    const mod = await import(join(COURSE_DIR, file));
    for (const value of Object.values(mod)) {
      // 읍면동 파일은 코스를 배열로 내놓는다 — 시군구 하나에 하나씩 252개다.
      if (Array.isArray(value)) courses.push(...value.filter(isCourse));
      else if (isCourse(value)) courses.push(value);
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
  /**
   * 만들어진 지도의 크기. 리포트에 실어 보낸다.
   *
   * buildCourse가 직접 찍던 줄이었는데, 그러면 **자기 PASS 줄보다 앞서** 나온다
   * (리포트는 돌려받은 뒤에 찍히므로). 로그에서 그 줄이 앞 코스의 것으로
   * 읽혀 엉뚱한 코스의 지도가 크다고 오해하게 된다.
   */
  size?: { width: number; height: number; kb: number };
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

/**
 * 코스 지도 위에 얹을 물길.
 *
 * **코스가 이미 잡아 둔 투영을 그대로 받는다.** 따로 맞추면 강이 제자리에
 * 안 얹힌다. 그리고 화면 밖은 잘라 낸다 — 전국 물길을 다 실으면 한강 하나
 * 보자고 낙동강까지 따라온다.
 *
 * 원본이 없으면 조용히 건너뛴다. 이 자료는 신청은 없지만 578MB라, 없다고
 * 빌드가 멈추면 지도조차 못 만든다.
 */
const waterCache = new Map<string, unknown>();
async function waterFor(
  land: GeoJsonMultiPolygon,
  projection: ReturnType<typeof geoMercator>,
  /** 이보다 짧게 그려지는 강줄기는 버린다. 전국 지도에서만 쓴다. */
  minLength = 0,
): Promise<{ lines: string; areas: string } | null> {
  const zip = join(OSM_DIR, OSM_ZIP);
  if (!existsSync(zip)) return null;

  if (!waterCache.has("loaded")) {
    process.stdout.write(`물길 원본을 읽는 중 ${OSM_ZIP}\n`);
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { mkdtemp, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const run = promisify(execFile);
    const dir = await mkdtemp(join(tmpdir(), "osm-"));
    try {
      const mapshaper = (await import("mapshaper")).default;
      for (const [key, name, filter] of [
        ["lines", "gis_osm_waterways_free_1", `-filter '${JSON.stringify(WATER_KINDS)}.indexOf(fclass) > -1'`],
        ["areas", "gis_osm_water_a_free_1", ""],
      ] as const) {
        await run("unzip", ["-q", "-o", zip, `${name}.*`, "-d", dir]);
        const out = await mapshaper.applyCommands(
          `-i in.shp ${filter} -o out.json format=geojson`,
          {
            "in.shp": await readFile(join(dir, `${name}.shp`)),
            "in.dbf": await readFile(join(dir, `${name}.dbf`)),
          },
        );
        waterCache.set(key, JSON.parse(Buffer.from(out["out.json"]).toString()));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    waterCache.set("loaded", true);
  }

  /*
   * **땅 모양으로 미리 잘라서 굽는다.**
   *
   * 화면에서 실루엣으로 가리기만 해 봤더니 서울 한 코스가 8KB에서 815KB가
   * 됐다. 안 보이는 물까지 전부 파일에 실렸기 때문이다 — 바다도 그중 하나다.
   * 가리는 것과 빼는 것은 다르다.
   *
   * 자르고 나면 바다는 저절로 사라진다. 땅과 안 겹치기 때문이다.
   */
  const mapshaper = (await import("mapshaper")).default;
  const clipped: Record<string, unknown> = {};
  for (const key of ["lines", "areas"] as const) {
    const out = await mapshaper.applyCommands(
      `-i in.json -clip land.json -simplify visvalingam resolution=${WATER_RESOLUTION} -o out.json format=geojson`,
      {
      "in.json": Buffer.from(JSON.stringify(waterCache.get(key))),
        "land.json": Buffer.from(
          JSON.stringify({ type: "Feature", properties: {}, geometry: land }),
        ),
      },
    );
    clipped[key] = JSON.parse(Buffer.from(out["out.json"]).toString());
  }

  const path = geoPath(projection).digits(1);
  /**
   * 판에서 터무니없이 벗어난 조각은 버린다.
   *
   * 클립이 바다 쪽에서 좌표가 십만 단위인 덩어리를 남긴다. 화면에서는
   * 클립에 가려 안 보이지만 파일에는 그대로 실리고, 무엇보다 그런 값이
   * 섞여 있으면 크기를 재는 잣대가 다 망가진다.
   */
  const offscreen = (d: string) => {
    const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    return n.some((v) => v < -2000 || v > 4000);
  };

  /** 그려 놓고 보니 티끌인 것을 버린다. 점 개수가 아니라 **화면에서의 크기**로 잰다. */
  const tiny = (d: string) => {
    const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    if (n.length < 4) return true;
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    /*
     * 전국 지도에서는 잣대를 더 올린다. 같은 저수지라도 축척이 달라지면
     * 몇 픽셀짜리 점이 되고, 점이 이백 개면 물이 아니라 잡티다.
     */
    const min = minLength > 0 ? WATER_MIN_PX * 3 : WATER_MIN_PX;
    return (
      Math.max(...xs) - Math.min(...xs) < min &&
      Math.max(...ys) - Math.min(...ys) < min
    );
  };

  const bake = (fc: unknown, drop = false) =>
    ((fc as { features?: unknown[] })?.features ?? [])
      .flatMap((f) => (path(f as Parameters<typeof path>[0]) ?? "").split("M").filter(Boolean))
      .map((piece) => `M${piece}`)
      .filter((d) => !offscreen(d))
      .filter((d) => !drop || !tiny(d))
      .join("");

  /** 그려진 길이. 점 사이 거리를 더한다. */
  const drawnLength = (d: string) => {
    const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    let total = 0;
    for (let i = 2; i + 1 < n.length; i += 2) {
      total += Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]);
    }
    return total;
  };

  const lines = bake(clipped.lines).length
    ? bake(clipped.lines)
        .split("M")
        .filter(Boolean)
        .map((piece) => `M${piece}`)
        .filter((d) => drawnLength(d) >= minLength)
        .join("")
    : "";
  const areas = bake(clipped.areas, true);
  return lines || areas ? { lines, areas } : null;
}

/**
 * 고도 띠.
 *
 * **화면 좌표 격자에서 바로 등고선을 뽑는다.** 지리 좌표로 격자를 만들어
 * 등고선을 뜬 뒤 투영하는 방법도 있지만, 그러면 등고선이 투영을 두 번 거쳐
 * 지역 경계와 미세하게 어긋난다. 판 위의 점마다 거꾸로 위경도를 물어
 * 고도를 읽으면 결과가 처음부터 화면 좌표라 어긋날 자리가 없다.
 *
 * 봉우리 점은 쓰지 않는다. 이름을 얹으면 정답이 새고(지역 이름 3,108개 중
 * 638개가 같은 어간의 봉우리를 갖는다) 이름을 빼면 점 무더기다.
 */
const demCache = new Map<string, Buffer | null>();
async function terrainFor(
  projection: ReturnType<typeof geoMercator>,
  width: number,
  height: number,
): Promise<string[] | null> {
  if (!existsSync(DEM_DIR)) return null;

  const tile = async (lat: number, lon: number): Promise<Buffer | null> => {
    const name = `N${String(lat).padStart(2, "0")}E${String(lon).padStart(3, "0")}`;
    if (!demCache.has(name)) {
      const path = join(DEM_DIR, `${name}.hgt`);
      demCache.set(name, existsSync(path) ? await readFile(path) : null);
    }
    return demCache.get(name) ?? null;
  };

  /* `.hgt`는 북서 모서리부터 서→동, 북→남으로 읽는다. -32768은 값 없음이다. */
  const elevation = async (lat: number, lon: number): Promise<number> => {
    const buf = await tile(Math.floor(lat), Math.floor(lon));
    if (!buf) return 0;
    const row = Math.round((Math.floor(lat) + 1 - lat) * (DEM_SIDE - 1));
    const col = Math.round((lon - Math.floor(lon)) * (DEM_SIDE - 1));
    const i = (row * DEM_SIDE + col) * 2;
    if (i < 0 || i + 1 >= buf.length) return 0;
    const v = buf.readInt16BE(i);
    return v === -32768 ? 0 : v;
  };

  const cols = Math.ceil(width / TERRAIN_STEP) + 1;
  const rows = Math.ceil(height / TERRAIN_STEP) + 1;
  const grid = new Float64Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const here = projection.invert?.([c * TERRAIN_STEP, r * TERRAIN_STEP]);
      grid[r * cols + c] = here ? await elevation(here[1], here[0]) : 0;
    }
  }

  const { contours } = await import("d3-contour");
  /* smooth를 끄면 계단이 남지만 점이 준다. 옅은 덩어리라 계단이 안 보인다. */
  const maker = contours().size([cols, rows]).thresholds(TERRAIN_BANDS).smooth(false);
  const path = geoPath().digits(0);

  /*
   * 바다는 따로 자를 필요가 없다.
   *
   * 띠가 100m 위부터 시작하므로 바다(0m)는 어느 띠에도 안 들어간다. 해안
   * 저지대도 마찬가지로 색이 없는데, 그게 맞다 — 거기는 낮은 땅이다.
   */
  /*
   * **점을 줄인다.**
   *
   * 격자를 따라 나온 계단은 점이 많다 — 강원 한 코스가 535KB였다. 좌표가
   * 격자 칸 단위라 여기서는 화면 좌표계가 아니고, 한 칸이 TERRAIN_STEP
   * 픽셀이다. 그래서 간격도 칸 단위로 준다.
   *
   * 섬 거르기는 산봉우리 하나짜리 얼룩을 없앤다. 띠가 뜻을 갖는 것은
   * 산줄기로 이어질 때이지, 점점이 흩어질 때가 아니다.
   */
  const thin = async (band: object): Promise<object> => {
    const out = await mapshaper.applyCommands(
      `-i in.json -filter-islands min-area=${TERRAIN_MIN_AREA} ` +
        `-simplify visvalingam interval=${TERRAIN_INTERVAL} -o out.json format=geojson`,
      { "in.json": Buffer.from(JSON.stringify(band)) },
    );
    return JSON.parse(Buffer.from(out["out.json"]).toString());
  };

  const mapshaper = (await import("mapshaper")).default;
  const bands: string[] = [];
  for (const band of maker(Array.from(grid))) {
    // 등고선은 격자 칸 단위로 나오므로 화면 좌표로 되돌린다.
    const raw = path((await thin(band)) as never) ?? "";
    if (!raw) {
      bands.push("");
      continue;
    }
    /*
     * 화면 좌표로 되돌리면서 정수로 자른다.
     *
     * 등고선은 계단 모양이라 소수점 아래가 아무 뜻이 없다 — 지역 경계와 달리
     * 이건 옅은 색 덩어리이고, 한 픽셀 어긋나는 것을 알아볼 수가 없다.
     */
    const scaled = raw.replace(/-?\d+(\.\d+)?/g, (m) =>
      String(Math.round(Number(m) * TERRAIN_STEP)),
    );
    bands.push(scaled);
  }

  return bands.some(Boolean) ? bands : null;
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
  // pool은 한 위상에서만 나온다(poolFor 참조). 조각에 실려 온 것을 그대로 쓴다.
  const landShape = merge(pool[0].topology, pool.map((p) => p.geom));
  const outline = outlinePath({
    type: "Feature" as const,
    properties: {},
    geometry: landShape,
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

  /*
   * 물길은 층에 따라 잣대가 다르다.
   *
   * 전국 지도에 실개천까지 얹으면 실타래가 되지만, 큰 강은 그 축척에서도
   * 지리를 설명한다 — 어느 도가 어느 강을 끼고 있는지가 읽힌다. 시군구
   * 아래로는 동네 하천이 그 동네의 표지라 다 남긴다.
   */
  const water = await waterFor(
    landShape,
    projection,
    // 전국 지도에서는 큰 강만. 실개천까지 얹으면 실타래가 된다.
    course.level === "sido" ? WATER_TRUNK_PX : 0,
  );

  const terrain = await terrainFor(projection, width, height);

  const out = {
    id: course.id,
    width,
    height,
    regions,
    ...(water ? { water } : {}),
    ...(terrain ? { terrain } : {}),
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, `${course.id}.json`), JSON.stringify(out));
  outlines[course.id] = { outline, borders };

  report.size = {
    width,
    height,
    kb: Math.round(JSON.stringify(out).length / 1024),
  };
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
  if (r.size) {
    process.stdout.write(`      ${r.size.width}×${r.size.height} · ${r.size.kb}KB\n`);
  }
  return ok;
}

/*
 * `ONLY=seoul npm run build:geo`로 한 코스만 굽는다.
 *
 * 270개를 다 굽는 데 한참 걸리는데, 물길 하나 손보고 확인하려고 매번
 * 전부 돌릴 이유가 없다. 쉼표로 여럿도 된다.
 */
const only = process.env.ONLY?.split(",").map((x) => x.trim()).filter(Boolean);
const courses = (await loadCourses())
  .filter((c) => c.geo)
  .filter((c) => !only || only.includes(c.id));
if (only) process.stdout.write(`ONLY=${only.join(",")} \u2014 ${courses.length}\uAC1C\uB9CC \uAD7D\uC2B5\uB2C8\uB2E4\n`);
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

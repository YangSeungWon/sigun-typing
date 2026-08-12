import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 코스 실루엣을 만든다. 실행: `npm run build:thumbs`
 *
 * 코스 카드에 지도를 넣고 싶은데 원본 경계는 코스 하나에 40~76KB다. 목록
 * 화면에 열일곱 개를 그대로 실으면 지도 때문에 목록이 느려진다.
 *
 * 카드에서 필요한 것은 정확한 경계가 아니라 **알아볼 수 있는 실루엣**이다.
 * 그래서 좌표를 0~100 격자로 반올림하고, 지역마다 점을 몇 개만 남기고,
 * 눈에 보이지도 않을 작은 섬은 버린다. 내부 경계선은 아예 그리지 않으므로
 * 도형들이 겹쳐 하나의 덩어리로 읽힌다.
 *
 * 결과는 파일 하나(data/thumbs.json)이고 코스당 1.5KB 안팎이다.
 */

const here = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = join(here, "..", "data", "geo");
/*
 * 코스 지도 폴더 밖에 둔다. 안에 두면 `./*.json`을 훑는 코드가 이 파일까지
 * 코스 지도로 집는다 — 실제로 지도 검사 여섯 개가 그렇게 깨졌다.
 */
const OUT = join(here, "..", "data", "thumbs.json");

/**
 * 실루엣 하나에 남길 점의 수.
 *
 * 예전에는 지역마다 14점씩 남겼다. 지역별로 따로 솎으니 맞닿은 두 지역이
 * 서로 다른 점을 남겨 공유 경계가 어긋났고, 내부 선을 그리지 않는 실루엣에서
 * 그 어긋남이 삐죽한 홈으로 보였다. 이제는 합쳐진 외곽선 하나를 솎으므로
 * 어긋날 경계 자체가 없고, 같은 점 수로 훨씬 매끄럽다.
 */
const POINTS_PER_SHAPE = 72;

/**
 * 경계선 하나에 남길 점의 수.
 *
 * 실루엣보다 적어도 되지만 너무 적으면 바깥 경계가 실루엣에서 벗어나
 * 가장자리에 후광처럼 남는다. 어차피 실루엣으로 잘라내기는 하지만,
 * 안쪽 경계도 이웃과 맞물려 보여야 구획으로 읽힌다.
 */
const POINTS_PER_BORDER = 16;
/** 지도 넓이의 이 비율보다 작은 덩어리는 버린다. */
const MIN_AREA_RATIO = 0.004;

/**
 * 좌표를 소수 한 자리까지 남긴다.
 *
 * 0~100 격자에 정수로 반올림했더니 카드에서 1칸이 1.3px, 고해상도 화면에서는
 * 2.6px짜리 계단이 됐다. 해안선이 톱니로 보이던 것이 대부분 이것이다.
 * 한 자리만 늘려도 계단은 사실상 사라진다.
 */
const round = (v: number) => Math.round(v * 10) / 10;

interface RegionShape {
  code: string;
  name: string;
  d: string;
  cx: number;
  cy: number;
}

interface CourseGeo {
  id: string;
  width: number;
  height: number;
  regions: RegionShape[];
}

interface Thumb {
  /** 0~100 격자에 그린 실루엣 */
  d: string;
  /**
   * 지역 경계. 채우지 않고 선으로만 그린다.
   *
   * 실루엣을 하나로 합친 뒤 잃은 것이 하나 있다 — 이 코스가 **여러 곳으로
   * 나뉜다**는 감각이다. 그건 지도가 할 수 있는 말이고 글자보다 빠르다.
   * 다만 늘 켜 두면 목록이 다시 얼기설기해지므로, 손이 닿을 때만 떠오른다.
   *
   * 채우기가 아니라 선이므로 예전 같은 틈은 생기지 않는다. 틈은 서로 다른
   * 면을 겹쳐 칠할 때 생기지, 선을 그을 때 생기지 않는다.
   */
  borders: string;
  /**
   * 코스가 지나는 길. 지역 순서대로 이은 꺾은선이다.
   *
   * 시작과 끝만 이은 직선으로는 "어디서 어디까지"밖에 말하지 못한다. 코스의
   * 값어치는 그 사이를 **어떻게 도는가**에 있고(은평에서 강북을 돌아 한강을
   * 건너…), 그건 길을 그려야 보인다.
   */
  route: [number, number][];
}

/** "M1,2L3,4Z" → [[1,2],[3,4]] 덩어리들 */
function subpaths(d: string): [number, number][][] {
  return d
    .split("M")
    .filter((part) => part.trim().length > 0)
    .map((part) => {
      const nums = part.match(/-?\d+(?:\.\d+)?/g) ?? [];
      const points: [number, number][] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        points.push([Number(nums[i]), Number(nums[i + 1])]);
      }
      return points;
    });
}

/** 다각형의 실제 넓이(신발끈). 사각형 넓이와 달리 바다를 세지 않는다. */
function shoelace(points: [number, number][]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return sum / 2;
}

function area(points: [number, number][]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

function thumbOf(geo: CourseGeo, outline: string): Thumb {
  const mapArea = geo.width * geo.height;

  /*
   * 그릴 덩어리를 고른다.
   *
   * 재료는 코스를 통째로 합친 외곽선 하나다(build-geo가 만든다). 여기서
   * 덩어리 하나는 지역이 아니라 **떨어져 있는 땅 하나**다 — 본토, 강화도,
   * 백령도처럼. 눈에 보이지도 않을 작은 섬은 버리되, 가장 큰 덩어리는
   * 무조건 남긴다. 제주처럼 코스 전체가 섬인 경우가 있다.
   */
  const parts = subpaths(outline).filter((points) => points.length >= 3);
  const biggest = parts.length > 0
    ? parts.reduce((a, b) => (area(a) >= area(b) ? a : b))
    : null;
  const shapes: [number, number][][] = [];
  for (const points of parts) {
    if (points !== biggest && area(points) / mapArea < MIN_AREA_RATIO) continue;
    const step = Math.max(1, Math.floor(points.length / POINTS_PER_SHAPE));
    const kept = points.filter((_, i) => i % step === 0);
    if (kept.length >= 3) shapes.push(kept);
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const points of shapes) {
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) {
    minX = 0; minY = 0; maxX = geo.width; maxY = geo.height;
  }

  // 가장자리가 잘리지 않도록 여백을 조금 남긴다.
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const fitScale = 92 / span;

  /*
   * 카드에서는 **보이는 크기**를 맞춘다.
   *
   * 사각형에 맞추기만 하면 코스마다 카드 속 땅 크기가 제각각이 된다. 인천이
   * 특히 심했다 — 옹진의 먼 섬까지 감싸느라 사각형이 바다로 넓어져서, 정작
   * 본토는 카드의 2%를 덮었다. 옆 카드의 서울은 37%다. 같은 목록에서 하나만
   * 점처럼 보이면 그건 축척이 아니라 고장으로 읽힌다.
   *
   * 여기는 지도 화면이 아니라 고르는 화면이므로 코스 간 축척이 정확할 이유가
   * 없다. 그래서 실루엣이 카드를 덮는 넓이를 기준으로 당기고 민다.
   */
  const TARGET_COVER = 0.3;
  /** 당기고 미는 한계. 사각형에 맞춘 크기에서 이 배수를 넘지 않는다. */
  const MIN_ZOOM = 0.8;
  const MAX_ZOOM = 2.8;

  const land = shapes.reduce((sum, points) => sum + Math.abs(shoelace(points)), 0);
  const cover = (land * fitScale * fitScale) / 10_000;
  const wanted = cover > 0 ? fitScale * Math.sqrt(TARGET_COVER / cover) : fitScale;

  /*
   * 당기는 중심은 사각형 한가운데가 아니라 **땅의 무게중심**이다. 사각형
   * 가운데는 인천처럼 땅이 한쪽에 몰린 코스에서 바다를 가리킨다.
   */
  const weight = shapes.map((points) => Math.abs(shoelace(points)));
  const total = weight.reduce((a, b) => a + b, 0) || 1;
  const centroid = (axis: 0 | 1) =>
    shapes.reduce((sum, points, i) => {
      const values = points.map((p) => p[axis]);
      const mid = (Math.min(...values) + Math.max(...values)) / 2;
      return sum + (mid * weight[i]) / total;
    }, 0);
  const cx = Number.isFinite(minX) ? centroid(0) : geo.width / 2;
  const cy = Number.isFinite(minX) ? centroid(1) : geo.height / 2;

  const first = geo.regions[0];
  const last = geo.regions[geo.regions.length - 1];
  /*
   * 시작·끝 표시는 되도록 카드 안에 둔다. 조금만 덜 당기면 담기는 경우에는
   * 그렇게 한다 — 마커가 잘리면 마우스를 올렸을 때 선이 허공에서 시작한다.
   *
   * 다만 마커에 무조건 맞추지는 않는다. 인천은 강화군에서 시작해 백령도가
   * 있는 옹진군에서 끝나므로, 둘을 다 담으려면 서해 전체를 담아야 하고 그러면
   * 본토가 다시 점이 된다. 그때는 마커를 가장자리에 붙인다 — 카드에서 마커가
   * 하는 말은 좌표가 아니라 "이쪽에서 저쪽으로"이기 때문이다.
   */
  const reach = Math.max(
    Math.abs(first.cx - cx), Math.abs(first.cy - cy),
    Math.abs(last.cx - cx), Math.abs(last.cy - cy),
    1,
  );
  const markerFit = 46 / reach;
  const zoomed = Math.min(Math.max(wanted, fitScale * MIN_ZOOM), fitScale * MAX_ZOOM);
  // 30%를 목표로 잡았으니 그 절반까지는 마커를 위해 양보한다.
  const scale = markerFit >= zoomed * 0.7 ? Math.min(zoomed, markerFit) : zoomed;

  const offsetX = 50 - cx * scale;
  const offsetY = 50 - cy * scale;
  const place = (x: number, y: number): [number, number] => [
    round(x * scale + offsetX),
    round(y * scale + offsetY),
  ];
  const grid = ([x, y]: [number, number]) => place(x, y).join(",");
  /** 경로의 점은 카드 안에 붙잡아 둔다. 실루엣은 잘려도 되지만 길은 안 된다. */
  const mark = (x: number, y: number): [number, number] => {
    const [px, py] = place(x, y);
    const clamp = (v: number) => Math.min(Math.max(v, 5), 95);
    return [clamp(px), clamp(py)];
  };

  /*
   * 경계선. 지역마다 본체 하나씩만 그린다 — 이 크기에서 부속 섬의 경계는
   * 점 몇 개로 뭉개져 얼룩으로 보인다.
   */
  const borders = geo.regions
    .map((region) => {
      const rings = subpaths(region.d).filter((points) => points.length >= 3);
      if (rings.length === 0) return "";
      const body = rings.reduce((a, b) => (area(a) >= area(b) ? a : b));
      const step = Math.max(1, Math.floor(body.length / POINTS_PER_BORDER));
      const kept = body.filter((_, i) => i % step === 0);
      return kept.length >= 3 ? `M${kept.map(grid).join("L")}Z` : "";
    })
    .join("");

  return {
    d: shapes.map((points) => `M${points.map(grid).join("L")}Z`).join(""),
    borders,
    route: geo.regions.map((r) => mark(r.cx, r.cy)),
  };
}

const files = (await readdir(GEO_DIR)).filter((f) => f.endsWith(".json"));

const outlines = JSON.parse(
  await readFile(join(here, "..", "data", "outlines.json"), "utf8"),
) as Record<string, string>;

const thumbs: Record<string, Thumb> = {};
for (const file of files.sort()) {
  const geo = JSON.parse(await readFile(join(GEO_DIR, file), "utf8")) as CourseGeo;
  const outline = outlines[geo.id];
  if (!outline) throw new Error(`${geo.id}의 외곽선이 없습니다 — npm run build:geo 먼저`);
  thumbs[geo.id] = thumbOf(geo, outline);
}

await writeFile(OUT, `${JSON.stringify(thumbs)}\n`, "utf8");

const size = JSON.stringify(thumbs).length;
process.stdout.write(
  `실루엣 ${Object.keys(thumbs).length}개 · ${Math.round(size / 1024)}KB ` +
    `(코스당 평균 ${Math.round(size / Object.keys(thumbs).length)}B)\n`,
);

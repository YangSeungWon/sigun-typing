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

/** 한 지역에 남길 점의 수. 64px 카드에서는 이 정도면 형태가 산다. */
const POINTS_PER_REGION = 14;
/** 지도 넓이의 이 비율보다 작은 덩어리는 버린다. */
const MIN_AREA_RATIO = 0.004;

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
  /** 코스의 시작과 끝 */
  from: [number, number];
  to: [number, number];
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

function thumbOf(geo: CourseGeo): Thumb {
  const mapArea = geo.width * geo.height;

  /*
   * 남길 덩어리를 먼저 고른다.
   *
   * 원본 지도 전체에 맞춰 크기를 정하면, 인천처럼 먼 섬을 가진 코스는
   * 본토가 손톱만 해진다. 여기는 지도 화면이 아니라 **고르는 데 쓰는 썸네일**
   * 이므로, 실제로 그릴 것들의 범위에 맞춰 채우는 편이 낫다. 그래야 코스마다
   * 시각적 크기가 고르게 나온다.
   */
  const shapes: [number, number][][] = [];
  for (const region of geo.regions) {
    const parts = subpaths(region.d).filter((points) => points.length >= 3);
    if (parts.length === 0) continue;

    /*
     * 지역마다 **가장 큰 덩어리는 무조건 남긴다.**
     *
     * 넓이만으로 걸렀더니 제주가 통째로 빠지고 끝 표시만 바다에 떠 있었다.
     * 코스에 든 지역은 작든 크든 그 코스의 일부다. 버리는 것은 한 지역 안의
     * 부속 섬들뿐이다.
     */
    const largest = parts.reduce((a, b) => (area(a) >= area(b) ? a : b));
    for (const points of parts) {
      if (points !== largest && area(points) / mapArea < MIN_AREA_RATIO) continue;
      const step = Math.max(1, Math.floor(points.length / POINTS_PER_REGION));
      const kept = points.filter((_, i) => i % step === 0);
      if (kept.length >= 3) shapes.push(kept);
    }
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
  const scale = 92 / span;
  const offsetX = (100 - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = (100 - (maxY - minY) * scale) / 2 - minY * scale;
  const place = (x: number, y: number): [number, number] => [
    Math.round(x * scale + offsetX),
    Math.round(y * scale + offsetY),
  ];
  const grid = ([x, y]: [number, number]) => place(x, y).join(",");

  const first = geo.regions[0];
  const last = geo.regions[geo.regions.length - 1];
  return {
    d: shapes.map((points) => `M${points.map(grid).join("L")}Z`).join(""),
    from: place(first.cx, first.cy),
    to: place(last.cx, last.cy),
  };
}

const files = (await readdir(GEO_DIR)).filter((f) => f.endsWith(".json"));

const thumbs: Record<string, Thumb> = {};
for (const file of files.sort()) {
  const geo = JSON.parse(await readFile(join(GEO_DIR, file), "utf8")) as CourseGeo;
  thumbs[geo.id] = thumbOf(geo);
}

await writeFile(OUT, `${JSON.stringify(thumbs)}\n`, "utf8");

const size = JSON.stringify(thumbs).length;
process.stdout.write(
  `실루엣 ${Object.keys(thumbs).length}개 · ${Math.round(size / 1024)}KB ` +
    `(코스당 평균 ${Math.round(size / Object.keys(thumbs).length)}B)\n`,
);

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
 * 결과는 파일 하나(data/geo/thumbs.json)이고 코스당 1KB 안팎이다.
 */

const here = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = join(here, "..", "data", "geo");
const OUT = join(GEO_DIR, "thumbs.json");

/** 한 지역에 남길 점의 수. 64px 카드에서는 이 정도면 형태가 산다. */
const POINTS_PER_REGION = 14;
/** 지도 넓이의 이 비율보다 작은 덩어리는 버린다. */
const MIN_AREA_RATIO = 0.002;

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
  const scale = 100 / Math.max(geo.width, geo.height);
  // 세로로 긴 지도가 가운데 오도록 남는 쪽을 반씩 나눈다.
  const offsetX = (100 - geo.width * scale) / 2;
  const offsetY = (100 - geo.height * scale) / 2;
  const grid = ([x, y]: [number, number]) =>
    `${Math.round(x * scale + offsetX)},${Math.round(y * scale + offsetY)}`;

  const mapArea = geo.width * geo.height;
  const parts: string[] = [];

  for (const region of geo.regions) {
    for (const points of subpaths(region.d)) {
      if (points.length < 3) continue;
      // 카드 크기에서 보이지도 않을 섬은 버린다.
      if (area(points) / mapArea < MIN_AREA_RATIO) continue;

      const step = Math.max(1, Math.floor(points.length / POINTS_PER_REGION));
      const kept = points.filter((_, i) => i % step === 0);
      if (kept.length < 3) continue;

      parts.push(`M${kept.map(grid).join("L")}Z`);
    }
  }

  const first = geo.regions[0];
  const last = geo.regions[geo.regions.length - 1];
  return {
    d: parts.join(""),
    from: [Math.round(first.cx * scale + offsetX), Math.round(first.cy * scale + offsetY)],
    to: [Math.round(last.cx * scale + offsetX), Math.round(last.cy * scale + offsetY)],
  };
}

const files = (await readdir(GEO_DIR)).filter(
  (f) => f.endsWith(".json") && f !== "thumbs.json",
);

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

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 결과를 이모지 격자로 자랑하기 위한 자리표. 실행: `npm run build:grid`
 *
 * 워들이 퍼진 이유는 점수가 아니라 **그림**이었다. 초록과 노랑 몇 줄이면 판
 * 하나가 통째로 전달되고, 받은 사람은 숫자를 읽는 게 아니라 남의 판을 본다.
 *
 * 여기서 한 칸은 지역 하나다. 그리고 칸이 실제 위치에 놓이므로 **격자가 곧
 * 그 코스의 지도다** — 서울을 공유하면 서울 모양이 뜬다. 이게 워들과 다른
 * 점이고, 이 게임이 지리 게임이기 때문에 가능한 것이다.
 *
 * ── 왜 빌드 때 굽는가 ───────────────────────────────────────
 * 자리를 정하려면 지역 경계 다각형에 점-포함 판정을 수만 번 돌리고, 배정을
 * 여러 번 맞바꿔 가며 다듬어야 한다. 코스는 800개가 넘고 경계는 안 바뀐다.
 * 브라우저에서 매번 할 이유가 없다.
 *
 * 결과물은 코스마다 `{cols, rows, cells}`이고 cells는 칸 순서대로의 지역
 * 코드(빈 칸은 null)다. 실제로 색을 칠하는 것은 lib/share/grid.ts다.
 */

const here = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = join(here, "../data/geo");
const OUT = join(here, "../data/emoji-grid.json");

/**
 * 이모지 한 칸은 정사각이 아니다 — 세로가 가로보다 길다.
 *
 * 이 보정이 없으면 서울이 납작해진다. 격자 행을 그만큼 덜 쓰고, 배정할 때
 * 재는 거리도 세로를 이만큼 멀게 친다.
 */
const CELL_ASPECT = 1.35;

/**
 * 땅 칸을 지역 수의 몇 배로 잡을 것인가.
 *
 * 딱 맞게 잡으면 격자가 꽉 차서 윤곽이 사라진다 — 시도 열일곱 개가 4×5
 * 네모가 됐다. 넉넉히 잡고 가장자리를 깎아야 오목한 데가 남는다.
 *
 * 더 주면 반대로 망가진다. 1.8 이상에서는 덮임이 높은 칸만 살아남아 속이
 * 뭉치고, 다시 네모가 된다.
 */
const SLACK = 1.5;

/** 칸 안을 이만큼 촘촘히 훑어 덮인 비율을 잰다. */
const SUB = 4;

type Point = [number, number];

interface Region {
  code: string;
  name: string;
  rings: Point[][];
  centroid: Point;
}

interface GeoFile {
  id: string;
  regions: { code: string; name: string; d: string }[];
}

export interface CourseGrid {
  cols: number;
  rows: number;
  /** 왼쪽 위부터 행 우선. 빈 칸은 null. */
  cells: (string | null)[];
}

/** 코스 경로는 전부 순수 다각형(M L Z)이라 곡선을 다룰 필요가 없다. */
function toRings(d: string): Point[][] {
  return d
    .split(/(?=M)/)
    .map((sub) => {
      const nums = sub.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      const pts: Point[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      return pts;
    })
    .filter((r) => r.length > 2);
}

/**
 * 면적 무게중심.
 *
 * 좌표를 그냥 평균내면 점이 촘촘한 쪽으로 끌린다 — 해안선이 그렇다. 섬이
 * 여럿이면 가장 큰 고리만 쓴다. 자리를 정하는 데 필요한 건 본토의 중심이다.
 */
function centroidOf(rings: Point[][]): Point {
  let best: Point = [0, 0];
  let bestArea = -1;
  for (const r of rings) {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
      a += f;
      cx += (r[j][0] + r[i][0]) * f;
      cy += (r[j][1] + r[i][1]) * f;
    }
    a /= 2;
    if (Math.abs(a) > bestArea) {
      bestArea = Math.abs(a);
      best = [cx / (6 * a), cy / (6 * a)];
    }
  }
  return best;
}

function inside(p: Point, rings: Point[][]): boolean {
  let hit = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (
        yi > p[1] !== yj > p[1] &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
      ) {
        hit = !hit;
      }
    }
  }
  return hit;
}

interface Box {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

interface Cell {
  x: number;
  y: number;
  /** 이 칸이 코스 땅에 덮인 비율 0~1 */
  cover: number;
}

/**
 * 칸마다 얼마나 덮였는지를 잰다.
 *
 * 가운데 점 하나로 보면 땅인지 아닌지만 알 뿐 어느 칸이 **더** 땅인지를
 * 모른다. 그러면 남는 칸을 버릴 때 실루엣 한복판이 뚫린다. 안쪽 칸은 덮임이
 * 1이므로, 낮은 것부터 버리면 잘리는 곳이 언제나 바깥이다.
 */
function landCells(regions: Region[], box: Box, cols: number): { rows: number; land: Cell[] } {
  const cw = box.w / cols;
  const rows = Math.max(1, Math.round(box.h / (cw * CELL_ASPECT)));
  const chh = box.h / rows;
  const land: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let hits = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const p: Point = [
            box.x0 + (x + (sx + 0.5) / SUB) * cw,
            box.y0 + (y + (sy + 0.5) / SUB) * chh,
          ];
          if (regions.some((r) => inside(p, r.rings))) hits++;
        }
      }
      if (hits > 0) land.push({ x, y, cover: hits / (SUB * SUB) });
    }
  }
  return { rows, land };
}

export function buildGrid(geo: GeoFile): CourseGrid {
  const regions: Region[] = geo.regions.map((r) => {
    const rings = toRings(r.d);
    return { code: r.code, name: r.name, rings, centroid: centroidOf(rings) };
  });

  const pts = regions.flatMap((r) => r.rings.flat());
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const box: Box = {
    x0,
    y0,
    w: Math.max(...xs) - x0 || 1,
    h: Math.max(...ys) - y0 || 1,
  };

  // 땅 칸이 지역 수보다 넉넉해지는 첫 해상도. 못 찾으면 자리라도 나오는 것으로.
  let pick: { cols: number; rows: number; land: Cell[] } | null = null;
  let fallback: typeof pick = null;
  for (let cols = 2; cols <= 64; cols++) {
    const { rows, land } = landCells(regions, box, cols);
    if (land.length < regions.length) continue;
    fallback ??= { cols, rows, land };
    if (land.length >= regions.length * SLACK) {
      pick = { cols, rows, land };
      break;
    }
  }
  const chosen = pick ?? fallback;
  if (!chosen) throw new Error(`${geo.id}: 지역 ${regions.length}곳을 앉힐 격자를 못 찾았다`);

  // 남는 칸은 가장자리에서만 버린다.
  const seats = [...chosen.land]
    .sort((a, b) => b.cover - a.cover)
    .slice(0, regions.length);

  const cw = box.w / chosen.cols;
  const chh = box.h / chosen.rows;
  const cost = (r: Region, c: Cell) => {
    const px = box.x0 + (c.x + 0.5) * cw;
    const py = box.y0 + (c.y + 0.5) * chh;
    return (
      ((r.centroid[0] - px) / cw) ** 2 + (((r.centroid[1] - py) / chh) * CELL_ASPECT) ** 2
    );
  };

  /*
   * 배정. 가까운 자리부터 붙인 뒤, 두 지역을 맞바꿔서 총 이동거리가 줄면
   * 바꾸는 것을 더 줄지 않을 때까지 반복한다. 그리디만으로는 먼저 온 지역이
   * 좋은 자리를 가져가 뒤엣것이 엉뚱한 데로 밀린다.
   */
  const free = [...seats];
  const seatOf = new Map<string, Cell>();
  for (const r of [...regions].sort((a, b) => a.centroid[1] - b.centroid[1])) {
    let bi = 0;
    let bc = Infinity;
    free.forEach((c, i) => {
      const v = cost(r, c);
      if (v < bc) {
        bc = v;
        bi = i;
      }
    });
    seatOf.set(r.code, free.splice(bi, 1)[0]);
  }
  const byCode = new Map(regions.map((r) => [r.code, r]));
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    const codes = [...seatOf.keys()];
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        const a = byCode.get(codes[i])!;
        const b = byCode.get(codes[j])!;
        const ca = seatOf.get(a.code)!;
        const cb = seatOf.get(b.code)!;
        if (cost(a, ca) + cost(b, cb) > cost(a, cb) + cost(b, ca) + 1e-9) {
          seatOf.set(a.code, cb);
          seatOf.set(b.code, ca);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // 가장자리 빈 줄·빈 열은 잘라 낸다. 제주가 4×4 한복판에 두 칸으로 뜨지 않게.
  const used = [...seatOf.values()];
  const minX = Math.min(...used.map((c) => c.x));
  const maxX = Math.max(...used.map((c) => c.x));
  const minY = Math.min(...used.map((c) => c.y));
  const maxY = Math.max(...used.map((c) => c.y));
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const cells: (string | null)[] = Array(cols * rows).fill(null);
  for (const [code, c] of seatOf) {
    cells[(c.y - minY) * cols + (c.x - minX)] = code;
  }
  return { cols, rows, cells };
}

const files = (await readdir(GEO_DIR)).filter((f) => f.endsWith(".json")).sort();
const out: Record<string, CourseGrid> = {};
let widest = 0;
for (const f of files) {
  const geo = JSON.parse(await readFile(join(GEO_DIR, f), "utf8")) as GeoFile;
  if (!geo.regions?.length) continue;
  const grid = buildGrid(geo);
  const placed = grid.cells.filter(Boolean).length;
  if (placed !== geo.regions.length) {
    throw new Error(`${geo.id}: 지역 ${geo.regions.length}곳 중 ${placed}곳만 앉았다`);
  }
  out[geo.id] = grid;
  widest = Math.max(widest, grid.cols);
}
await writeFile(OUT, `${JSON.stringify(out)}\n`);
console.log(`코스 ${Object.keys(out).length}개 · 가장 넓은 격자 ${widest}칸 → data/emoji-grid.json`);

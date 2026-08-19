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

/**
 * 육지에서 떼어 놓을 지역.
 *
 * 격자 행 하나가 실좌표 50 단위쯤인데 남해안과 제주 사이 바다가 그보다 좁다.
 * 그래서 반올림하면 바다가 통째로 사라지고, 제주가 전라남도 옆에 붙어 버린다.
 * 섬이라는 사실이 격자에서 아예 안 보인다.
 *
 * **연결 요소를 자동으로 찾는 방법은 버렸다.** 해안 코스마다 갯바위가 다
 * 걸린다 — 부산 남구는 덩어리가 스물넷이고 그 스물셋이 용호동 앞바다의
 * 바위섬이다. 그것들까지 떼어 놓으면 격자가 산산조각 난다.
 *
 * 떼어 놓을 값이 있는 것은 **지역 전체가 먼바다에 있는 경우**뿐이고, 실제로
 * 셋이다. 자동 규칙으로 이 셋만 고르려다 임계값 놀음이 되느니 이름을 적는다.
 * 코드가 사라지면 grid.test.ts가 잡는다.
 */
const OFFSHORE = new Set([
  "28720", // 인천 옹진군 — 백령·연평
  "47940", // 경북 울릉군
  "50", // 제주특별자치도 (시도 코스)
  "50110", // 제주시 (전국 코스)
  "50130", // 서귀포시 (전국 코스)
]);

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

  /*
   * 섬은 육지 배치에서 빼고 나중에 따로 앉힌다. 함께 넣으면 경계 상자가
   * 제주까지 늘어나 육지 해상도가 낮아지고, 정작 바다는 사라진다.
   *
   * 코스가 통째로 섬이면(제주 2 행정시) 떼어 낼 육지가 없다. 그때는 평소대로.
   */
  const offshore = regions.filter((r) => OFFSHORE.has(r.code));
  const mainland = regions.filter((r) => !OFFSHORE.has(r.code));
  const seated = offshore.length > 0 && mainland.length > 0 ? mainland : regions;
  const detached = seated === mainland ? offshore : [];

  const pts = seated.flatMap((r) => r.rings.flat());
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
  type Pick = { cols: number; rows: number; land: Cell[] };
  let pick: Pick | null = null;
  let fallback: Pick | null = null;
  for (let cols = 2; cols <= 64; cols++) {
    const { rows, land } = landCells(seated, box, cols);
    if (land.length < seated.length) continue;
    fallback ??= { cols, rows, land };
    if (land.length >= seated.length * SLACK) {
      pick = { cols, rows, land };
      break;
    }
  }
  const chosen = pick ?? fallback;
  if (!chosen) throw new Error(`${geo.id}: 지역 ${seated.length}곳을 앉힐 격자를 못 찾았다`);

  // 남는 칸은 가장자리에서만 버린다.
  const seats = [...chosen.land]
    .sort((a, b) => b.cover - a.cover)
    .slice(0, seated.length);

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
  for (const r of [...seated].sort((a, b) => a.centroid[1] - b.centroid[1])) {
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
  const byCode = new Map(seated.map((r) => [r.code, r]));
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

  /*
   * 섬을 앉힌다.
   *
   * 먼저 실제 좌표가 가리키는 칸에 놓는다. 육지 격자 밖으로 나가도 된다 —
   * 아래에서 경계를 넓힌다. 그다음 육지에서 멀어지는 쪽으로 한 칸씩 밀어,
   * 어느 육지 칸과도 대각선으로조차 닿지 않을 때까지 보낸다. 그래야 그 사이가
   * 바다로 읽힌다.
   *
   * 미는 방향은 실제 방위다. 제주는 남쪽, 울릉은 동쪽, 옹진은 서쪽으로 간다.
   * 방향을 고정하지 않는 이유는 셋의 방위가 다르기 때문이고, 그래서 전국
   * 코스에서 셋이 각자 제자리로 흩어진다.
   */
  if (detached.length > 0) {
    const mainCells = [...seatOf.values()];
    const mx = mainCells.reduce((a, c) => a + c.x, 0) / mainCells.length;
    const my = mainCells.reduce((a, c) => a + c.y, 0) / mainCells.length;
    const taken = new Set(mainCells.map((c) => `${c.x},${c.y}`));

    // 남쪽 섬부터. 여럿이 같은 쪽으로 갈 때 먼 것이 먼저 자리를 잡아야
    // 가까운 것이 그 안쪽에 앉는다(제주시와 서귀포시가 붙어 있어야 한다).
    const ordered = [...detached].sort(
      (a, b) => (b.centroid[1] - a.centroid[1]) || (a.centroid[0] - b.centroid[0]),
    );
    const lo = (v: number[]) => Math.min(...v);
    const hi = (v: number[]) => Math.max(...v);
    const bx = [lo(mainCells.map((c) => c.x)), hi(mainCells.map((c) => c.x))];
    const by = [lo(mainCells.map((c) => c.y)), hi(mainCells.map((c) => c.y))];
    const clamp = (v: number, [a, b]: number[]) => Math.min(b + 2, Math.max(a - 2, v));

    for (const r of ordered) {
      /*
       * 실제 거리만큼 보내면 격자가 바다로 뒤덮인다 — 전국이 36칸 폭이 됐고
       * 인천은 열아홉 칸 중 열일곱이 빈칸이었다. 방향만 살리고 거리는 버린다.
       * 섬이라는 사실을 말하는 데 필요한 것은 한 칸의 바다지 실제 해리가 아니다.
       */
      let x = clamp(Math.round((r.centroid[0] - box.x0) / cw - 0.5), bx);
      let y = clamp(Math.round((r.centroid[1] - box.y0) / chh - 0.5), by);
      const dx = Math.sign(x - mx) || 0;
      const dy = Math.sign(y - my) || 1;
      // 방위가 뚜렷한 축으로만 민다. 둘 다 밀면 대각선으로 흘러 엉뚱한 데 간다.
      const [stepX, stepY] =
        Math.abs(x - mx) * CELL_ASPECT > Math.abs(y - my) ? [dx, 0] : [0, dy];
      // 육지와 대각선으로도 닿으면 안 되고, 먼저 앉은 섬과 겹쳐도 안 된다.
      const clash = () =>
        mainCells.some((c) => Math.abs(c.x - x) <= 1 && Math.abs(c.y - y) <= 1) ||
        taken.has(`${x},${y}`);
      let guard = 0;
      while (clash() && guard++ < 64) {
        x += stepX;
        y += stepY;
      }
      taken.add(`${x},${y}`);
      seatOf.set(r.code, { x, y, cover: 1 });
    }
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

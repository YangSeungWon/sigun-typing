import type { ItemResult } from "@/lib/game/types";

/**
 * 결과를 이모지 격자로.
 *
 * 워들이 퍼진 이유는 점수가 아니라 그림이었다. 초록과 노랑 몇 줄이면 판 하나가
 * 통째로 전달되고, 받은 사람은 숫자를 읽는 대신 남의 판을 본다.
 *
 * 여기서는 한 칸이 지역 하나이고, 칸이 실제 위치에 놓인다. 그래서 **격자가
 * 곧 그 코스의 지도다** — 서울을 공유하면 서울 모양이 뜬다. 자리를 정하는 일은
 * 빌드 때 끝나 있다(scripts/build-emoji-grid.mts).
 */

export interface CourseGrid {
  cols: number;
  rows: number;
  /** 왼쪽 위부터 행 우선. 빈 칸은 null. */
  cells: (string | null)[];
}

/**
 * 칸 하나의 색.
 *
 * 셋으로 끊는다. 더 나누면 받는 사람이 범례를 읽어야 하는데, 채팅방에 붙는
 * 그림에 범례를 붙일 수는 없다.
 *
 * 노랑은 "헤맸다"이지 "힌트를 봤다"가 아니다. 초성을 본 것과 한 번 틀리고
 * 고쳐 맞힌 것은 같은 일이다 — 둘 다 바로 안 떠올랐다는 뜻이다.
 */
const EMOJI = {
  clean: "🟩",
  struggled: "🟨",
  missed: "🟥",
  empty: "⬜",
} as const;

function mark(r: ItemResult | undefined): string {
  // 판을 도중에 접으면 뒤쪽 지역은 결과 자체가 없다. 못 맞힌 것으로 친다.
  if (!r || r.skipped) return EMOJI.missed;
  if (r.hinted || r.errors > 0 || r.attempts > 1) return EMOJI.struggled;
  return EMOJI.clean;
}

export function renderGrid(grid: CourseGrid, results: ItemResult[]): string {
  const byId = new Map(results.map((r) => [r.id, r]));
  const lines: string[] = [];
  for (let y = 0; y < grid.rows; y++) {
    let line = "";
    for (let x = 0; x < grid.cols; x++) {
      const code = grid.cells[y * grid.cols + x];
      line += code === null ? EMOJI.empty : mark(byId.get(code));
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export interface ShareTextInput {
  courseName: string;
  grid: CourseGrid | null;
  results: ItemResult[];
  completed: number;
  total: number;
  /** 이미 다듬어진 기록 문자열 (`01:03.00`) */
  time: string;
  hintsUsed: number;
}

/**
 * 붙여넣을 덩어리.
 *
 * 주소는 여기 넣지 않는다. `navigator.share`가 url을 따로 받고, 그걸 본문에도
 * 적으면 카톡에서 주소가 두 번 뜬다. 클립보드로 떨어질 때만 부르는 쪽에서 붙인다.
 */
export function shareText(input: ShareTextInput): string {
  const { courseName, grid, results, completed, total, time, hintsUsed } = input;
  const head = [
    `시군 타이핑 · ${courseName}`,
    `${completed}/${total} · ${time}${hintsUsed > 0 ? ` · 힌트 ${hintsUsed}` : ""}`,
  ];
  // 격자가 없는 코스도 자랑은 할 수 있어야 한다. 숫자만 남는다.
  const body = grid ? ["", renderGrid(grid, results)] : [];
  return [...head, ...body, "", "너는 나보다 빠름?"].join("\n");
}

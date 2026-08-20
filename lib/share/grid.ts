import type { ItemResult } from "@/lib/game/types";
import { MARK, markOf, type Mark } from "@/lib/game/marks";

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
export const EMOJI: Record<Mark, string> = {
  [MARK.clean]: "🟩",
  [MARK.struggled]: "🟨",
  [MARK.missed]: "🟥",
};
const EMPTY = "⬜";

/**
 * 격자에 앉은 지역 코드를 칸 순서대로.
 *
 * 주소에 실어 보내는 상태 꾸러미도 이 순서를 따른다. 양쪽이 같은 자리표를
 * 들고 있으므로 순서를 따로 보낼 필요가 없다.
 */
export function seatOrder(grid: CourseGrid): string[] {
  return grid.cells.filter((c): c is string => c !== null);
}

export function marksFor(grid: CourseGrid, results: ItemResult[]): Mark[] {
  const byId = new Map(results.map((r) => [r.id, r]));
  return seatOrder(grid).map((code) => markOf(byId.get(code)));
}

export function renderGrid(grid: CourseGrid, results: ItemResult[]): string {
  const byId = new Map(results.map((r) => [r.id, r]));
  const lines: string[] = [];
  for (let y = 0; y < grid.rows; y++) {
    let line = "";
    for (let x = 0; x < grid.cols; x++) {
      const code = grid.cells[y * grid.cols + x];
      line += code === null ? EMPTY : EMOJI[markOf(byId.get(code))];
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
  elapsedMs: number;
  hintsUsed: number;
  /**
   * 대결에서 몇 명 중 몇 등이었는지. 혼자 한 판에는 없다.
   *
   * 대결의 자랑거리는 초가 아니라 등수다 — 1분 12초가 빠른지 느린지는 아무도
   * 모르지만 `8명 중 1위`는 그 자체로 읽힌다.
   */
  standing?: { rank: number; field: number } | null;
}

/**
 * 사람이 읽는 기록.
 *
 * `01:03.00`은 계기판의 문법이다. 채팅방에 붙는 문장에서는 사람이 입으로 말하는
 * 대로 적는다 — 41.08초, 1분 12.44초.
 */
export function spokenDuration(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = (total % 60).toFixed(2);
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

/**
 * 붙여넣을 덩어리.
 *
 * ── 가운데점을 쓰지 않는다 ──────────────────────────────────
 * 값과 값을 `·`로 잇는 것은 대시보드의 문법이다. 남에게 보내는 메시지에서는
 * 구분자가 아니라 잡음으로 읽히고, 기계가 뱉은 것처럼 보인다. 줄바꿈으로 나눈다.
 * 그러면 덩어리 전체가 문장이 아니라 **결과판**으로 보인다.
 *
 * ── 마지막 줄은 초대다 ────────────────────────────────────
 * `너는 나보다 빠름?`이었다. 도발은 이미 이긴 사람만 즐겁고, 받은 사람에게는
 * 자랑으로 읽힌다. `같이 한 판?`은 자랑도 설명도 아니고 다음 차례를 넘긴다 —
 * 방 초대에서 이미 쓰는 말이기도 하다(MultiRoom의 `같이 한 판 하자`).
 *
 * 도전할 값은 이 줄이 아니라 링크가 들고 간다. 주소에 기록이 실려 있어서 받은
 * 사람은 그 기록이 목표로 박힌 판에 떨어진다. 그러니 문장이 "몇 초 안에
 * 해보세요"라고 다시 말할 이유가 없다.
 *
 * 주소는 여기 넣지 않는다. `navigator.share`가 url을 따로 받고, 그걸 본문에도
 * 적으면 카톡에서 주소가 두 번 뜬다. 클립보드로 떨어질 때만 부르는 쪽에서 붙인다.
 */
export function shareText(input: ShareTextInput): string {
  const { courseName, grid, results, completed, total, elapsedMs, hintsUsed, standing } =
    input;

  const lines = ["시군 타이핑", `${courseName} ${spokenDuration(elapsedMs)}`];

  // 격자가 없는 코스도 자랑은 할 수 있어야 한다. 그때는 숫자만 남는다.
  if (grid) lines.push("", renderGrid(grid, results));

  lines.push("");
  // 등수를 곳 수보다 위에 둔다. 대결에서 먼저 읽히는 숫자다.
  if (standing) lines.push(`${standing.field}명 중 ${standing.rank}위`);
  lines.push(completed === total ? `${total}곳 전부` : `${total}곳 중 ${completed}곳`);
  if (hintsUsed > 0) lines.push(`힌트 ${hintsUsed}번`);

  lines.push("", "같이 한 판?");
  return lines.join("\n");
}

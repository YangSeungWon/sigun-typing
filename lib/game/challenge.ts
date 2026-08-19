/**
 * 남이 보낸 도전장.
 *
 * 서버도 읽어야 해서 클라이언트 모듈 밖에 둔다. `/c/...` 경로가 생기면서
 * 서버가 링크만 보고 미리보기 카드를 짓게 됐고, 그러려면 이 규칙이 양쪽에서
 * 같아야 한다. `lib/analytics/track.ts`는 `"use client"`라 거기 두면 못 부른다.
 *
 * 서버에 남기지 않는 이유: 도전 카드 하나 만들자고 남의 기록과 이름을 쌓을
 * 이유가 없다. 이 값은 화면 문구일 뿐 순위에 관여하지 않으므로, 고쳐 봐야
 * 자기 화면의 목표 시간만 바뀐다.
 */
export interface Challenge {
  beatMs: number;
  by: string | null;
}

/**
 * 값을 다듬는다.
 *
 * 주소 쿼리에서 왔든 경로에서 왔든 같은 규칙을 지난다. 들어오는 문이 둘인데
 * 문마다 규칙이 다르면 한쪽만 조용히 헐거워진다.
 */
export function toChallenge(beat: unknown, by: unknown): Challenge | null {
  const ms = Number(beat);
  // 하루가 넘는 기록은 장난이다.
  if (!Number.isFinite(ms) || ms <= 0 || ms > 86_400_000) return null;
  const name = typeof by === "string" ? by : null;
  return {
    beatMs: Math.floor(ms),
    by: name ? name.replace(/[\p{C}]/gu, "").trim().slice(0, 12) || null : null,
  };
}

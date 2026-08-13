export type RankingPeriod = "today" | "week" | "all";

export const RANKING_PERIODS: RankingPeriod[] = ["today", "week", "all"];

export const PERIOD_LABELS: Record<RankingPeriod, string> = {
  today: "오늘",
  week: "이번 주",
  all: "전체",
};

/**
 * 한국 표준시 고정 오프셋. 한국은 서머타임을 쓰지 않아 연중 +9로 일정하다.
 */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 기간의 시작 시각. 전체 기간이면 null.
 *
 * 서버 지역 시간으로 자르면 안 된다. 컨테이너는 UTC로 도는데 사용자는 한국에
 * 있으므로, 그대로 두면 순위표가 한국 시간 아침 9시에 초기화된다.
 * 그래서 KST 벽시계로 옮겨 자른 뒤 다시 UTC 순간으로 되돌린다.
 *
 * 주의 시작은 월요일이다.
 */
export function periodStart(period: RankingPeriod, now: number): Date | null {
  if (period === "all") return null;

  const kst = new Date(now + KST_OFFSET_MS);
  // getUTC*를 쓰는 이유: kst는 이미 한국 벽시계를 UTC 필드에 담아 둔 값이다.
  let startOfDay = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate(),
  );

  if (period === "week") {
    // getUTCDay(): 0=일요일. 월요일을 주의 시작으로 삼으므로 일요일은 6일 전이다.
    const daysSinceMonday = (kst.getUTCDay() + 6) % 7;
    startOfDay -= daysSinceMonday * 24 * 60 * 60 * 1000;
  }

  return new Date(startOfDay - KST_OFFSET_MS);
}

export function isRankingPeriod(value: string): value is RankingPeriod {
  return (RANKING_PERIODS as string[]).includes(value);
}

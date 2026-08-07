import { describe, expect, it } from "vitest";
import { isRankingPeriod, periodStart } from "./period";

/** KST 벽시계로 읽은 시각을 UTC epoch로. */
function kst(y: number, m: number, d: number, h = 0, min = 0): number {
  return Date.UTC(y, m - 1, d, h - 9, min);
}

/** 결과를 KST 벽시계 문자열로 되돌려 읽기 쉽게 한다. */
function asKst(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);
}

describe("periodStart", () => {
  it("전체 기간은 자르지 않는다", () => {
    expect(periodStart("all", kst(2026, 8, 6, 15))).toBeNull();
  });

  it("오늘은 KST 자정부터다", () => {
    expect(asKst(periodStart("today", kst(2026, 8, 6, 15, 30)))).toBe(
      "2026-08-06 00:00",
    );
  });

  /**
   * 서버 지역 시간으로 잘랐다면 여기서 어긋난다. UTC 8월 5일 16시는
   * 이미 한국에서 8월 6일 새벽 1시다.
   */
  it("UTC 날짜가 아니라 KST 날짜를 기준으로 자른다", () => {
    const utcStillYesterday = Date.UTC(2026, 7, 5, 16, 0); // KST 8/6 01:00
    expect(asKst(periodStart("today", utcStillYesterday))).toBe(
      "2026-08-06 00:00",
    );
  });

  it("KST 자정 직후도 그날에 속한다", () => {
    expect(asKst(periodStart("today", kst(2026, 8, 6, 0, 1)))).toBe(
      "2026-08-06 00:00",
    );
  });

  it("KST 자정 직전은 전날이다", () => {
    expect(asKst(periodStart("today", kst(2026, 8, 6, 23, 59)))).toBe(
      "2026-08-06 00:00",
    );
    expect(asKst(periodStart("today", kst(2026, 8, 5, 23, 59)))).toBe(
      "2026-08-05 00:00",
    );
  });

  it("주는 월요일에 시작한다", () => {
    // 2026-08-06은 목요일
    expect(asKst(periodStart("week", kst(2026, 8, 6, 12)))).toBe(
      "2026-08-03 00:00",
    );
  });

  it("일요일은 지난 월요일에 속한다 — 주가 하루짜리로 끊기지 않는다", () => {
    // 2026-08-09는 일요일
    expect(asKst(periodStart("week", kst(2026, 8, 9, 23)))).toBe(
      "2026-08-03 00:00",
    );
  });

  it("월요일 당일은 그날이 주의 시작이다", () => {
    expect(asKst(periodStart("week", kst(2026, 8, 3, 0, 5)))).toBe(
      "2026-08-03 00:00",
    );
  });

  it("월이 바뀌어도 주가 이어진다", () => {
    // 2026-09-01은 화요일 → 주의 시작은 8/31 월요일
    expect(asKst(periodStart("week", kst(2026, 9, 1, 10)))).toBe(
      "2026-08-31 00:00",
    );
  });

  it("오늘의 시작은 언제나 이번 주의 시작보다 늦거나 같다", () => {
    for (let day = 1; day <= 28; day++) {
      const now = kst(2026, 8, day, 12);
      const today = periodStart("today", now)!.getTime();
      const week = periodStart("week", now)!.getTime();
      expect(today, `8/${day}`).toBeGreaterThanOrEqual(week);
      expect(today, `8/${day}`).toBeLessThanOrEqual(now);
    }
  });
});

describe("isRankingPeriod", () => {
  it("아는 값만 통과시킨다", () => {
    expect(isRankingPeriod("today")).toBe(true);
    expect(isRankingPeriod("week")).toBe(true);
    expect(isRankingPeriod("all")).toBe(true);
    expect(isRankingPeriod("month")).toBe(false);
    expect(isRankingPeriod("")).toBe(false);
  });
});

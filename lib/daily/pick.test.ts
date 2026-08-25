import { describe, expect, it } from "vitest";
import { dayIndex, EPOCH_KST, pickForDay, pickIndex, quizDate } from "./pick";

/** KST 벽시계로 읽은 시각을 UTC epoch로. */
function kst(y: number, m: number, d: number, h = 0): number {
  return Date.UTC(y, m - 1, d, h) - 9 * 60 * 60 * 1000;
}

describe("며칠째인가", () => {
  it("첫날이 0일차다", () => {
    expect(dayIndex(EPOCH_KST - 9 * 60 * 60 * 1000)).toBe(0);
  });

  it("KST 자정에 넘어간다", () => {
    // 서버는 UTC로 도는데 사람은 한국에 있다. UTC 자정으로 자르면 한국 시간
    // 아침 아홉 시에 문제가 바뀐다.
    const before = dayIndex(kst(2026, 8, 21, 23));
    const after = dayIndex(kst(2026, 8, 22, 0));
    expect(after).toBe(before + 1);
  });

  it("같은 날 어느 시각에 물어도 같은 날짜다", () => {
    const day = dayIndex(kst(2026, 9, 5, 0));
    for (const h of [1, 7, 12, 18, 23]) {
      expect(dayIndex(kst(2026, 9, 5, h))).toBe(day);
    }
  });
});

describe("한 바퀴를 다 돌고 나서 반복한다", () => {
  const TOTAL = 229;

  it("229일 동안 같은 곳이 두 번 안 나온다", () => {
    const seen = new Set<number>();
    for (let day = 0; day < TOTAL; day++) seen.add(pickIndex(day, TOTAL));
    expect(seen.size).toBe(TOTAL);
  });

  it("두 바퀴째가 첫 바퀴의 회전이 아니다", () => {
    /*
     * 시작점만 옮기면 배열은 달라지는데 **순서는 같다** — 229일 뒤에 어제와
     * 오늘의 짝이 통째로 되풀이된다. 처음 테스트가 `not.toEqual`만 봐서 이걸
     * 놓쳤고, 실제로 229·230·231일차가 10·11·12일차와 같았다.
     */
    const first = Array.from({ length: TOTAL }, (_, d) => pickIndex(d, TOTAL));
    const second = Array.from({ length: TOTAL }, (_, d) => pickIndex(d + TOTAL, TOTAL));
    expect(new Set(second).size).toBe(TOTAL);
    for (let shift = 0; shift < TOTAL; shift++) {
      const rotated = first.map((_, i) => first[(i + shift) % TOTAL]);
      expect(second, `${shift}칸 회전과 같다`).not.toEqual(rotated);
    }
  });

  it("이웃한 날이 지도에서도 이웃하지 않는다", () => {
    // 코드 순서가 곧 행정구역 순서다. 보폭이 작으면 어제 옆 동네가 오늘 나온다.
    for (let day = 0; day < TOTAL - 1; day++) {
      const gap = Math.abs(pickIndex(day, TOTAL) - pickIndex(day + 1, TOTAL));
      expect(Math.min(gap, TOTAL - gap)).toBeGreaterThan(5);
    }
  });

  it("총 개수가 보폭과 서로소가 아니어도 다 돈다", () => {
    // 97의 배수인 코스가 생겨도 조용히 같은 곳만 반복하면 안 된다.
    const seen = new Set<number>();
    for (let day = 0; day < 97; day++) seen.add(pickIndex(day, 97));
    expect(seen.size).toBe(97);
  });
});

describe("오늘의 한 곳", () => {
  it("같은 날이면 어디서 물어도 같은 곳이다", () => {
    const items = ["가", "나", "다", "라"];
    const morning = pickForDay(items, kst(2026, 8, 25, 6));
    const night = pickForDay(items, kst(2026, 8, 25, 23));
    expect(morning).toEqual(night);
  });

  it("고를 것이 없으면 null이다", () => {
    expect(pickForDay([], Date.now())).toBeNull();
  });
});

describe("quizDate", () => {
  it("0일차는 첫날이다", () => {
    expect(quizDate(0)).toBe("8월 19일");
  });

  it("달을 넘어간다", () => {
    // 8월 19일 + 13일 = 9월 1일
    expect(quizDate(13)).toBe("9월 1일");
  });

  it("해를 넘어가도 KST 달력을 따른다", () => {
    // 2026-08-19 + 134일 = 2026-12-31, + 135일 = 2027-01-01
    expect(quizDate(134)).toBe("12월 31일");
    expect(quizDate(135)).toBe("1월 1일");
  });
});

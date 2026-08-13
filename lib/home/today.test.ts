import { describe, expect, it } from "vitest";
import { kstDateKey, pickDailyCourse } from "./today";

/** UTC 기준 시각을 밀리초로. 테스트에서 경계를 눈에 보이게 쓰기 위한 것. */
function utc(iso: string): number {
  return Date.parse(iso);
}

describe("한국 날짜", () => {
  it("UTC 15시에 날짜가 넘어간다", () => {
    // 한국 자정 = UTC 15:00. 서버를 UTC로 두고 그냥 자르면 아침 9시에 바뀐다.
    expect(kstDateKey(utc("2026-08-13T14:59:59Z"))).toBe("2026-08-13");
    expect(kstDateKey(utc("2026-08-13T15:00:00Z"))).toBe("2026-08-14");
  });

  it("월과 일을 두 자리로 채운다", () => {
    expect(kstDateKey(utc("2026-01-04T00:00:00Z"))).toBe("2026-01-04");
  });

  it("연말에도 넘어간다", () => {
    expect(kstDateKey(utc("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});

describe("오늘의 코스", () => {
  const ids = ["sido", "seoul", "gyeonggi", "gangwon", "jeju"];

  it("같은 날이면 늘 같은 코스다", () => {
    expect(pickDailyCourse(ids, "2026-08-13")).toBe(pickDailyCourse(ids, "2026-08-13"));
  });

  it("코스 목록에 있는 것만 고른다", () => {
    expect(ids).toContain(pickDailyCourse(ids, "2026-08-13"));
  });

  it("고를 것이 없으면 없다", () => {
    expect(pickDailyCourse([], "2026-08-13")).toBeNull();
  });

  it("한 코스에 몰리지 않는다", () => {
    /*
     * `날짜 % 개수`로 나누면 열일곱 일마다 같은 순서가 돌아 요일과 코스가
     * 굳는다. 해시를 통과시키는 이유가 이것이므로 여기서 확인한다.
     */
    const seventeen = Array.from({ length: 17 }, (_, i) => `c${i}`);
    const picks = Array.from({ length: 60 }, (_, i) =>
      pickDailyCourse(seventeen, kstDateKey(utc("2026-08-13T00:00:00Z") + i * 86_400_000)),
    );
    const counts = new Map<string | null, number>();
    for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);

    // 60일에 17코스면 평균 3.5회. 한 코스가 열 번 넘게 나오면 흩어진 것이 아니다.
    expect(Math.max(...counts.values())).toBeLessThan(10);
    expect(counts.size).toBeGreaterThan(10);
  });
});

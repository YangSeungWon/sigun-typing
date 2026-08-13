import { describe, expect, it } from "vitest";
import { aggregateConquest, sidoProgress } from "./conquest";
import type { CourseMastery } from "../score/mastery";
import type { CourseSummary, SidoSummary } from "./summary";

const COURSES: CourseSummary[] = [
  { id: "sido", name: "전국 17 시도", shortName: "전국", overlapping: false, version: 1, total: 17, sido: "11" },
  { id: "seoul", name: "서울 25개 구", shortName: "서울", overlapping: false, version: 2, total: 25, sido: "11" },
  { id: "jeju", name: "제주 2 행정시", shortName: "제주", overlapping: false, version: 1, total: 2, sido: "50" },
];

const SIDO: SidoSummary[] = [
  { code: "11", name: "서울", courseId: "seoul", total: 25 },
  { code: "36", name: "세종", total: 0 },
  { code: "50", name: "제주", courseId: "jeju", total: 2 },
];

function mastery(entries: Record<string, Partial<CourseMastery>>): Map<string, CourseMastery> {
  return new Map(
    Object.entries(entries).map(([id, m]) => [
      id,
      { courseId: id, played: true, total: 0, known: 0, stuckCodes: [], ...m },
    ]),
  );
}

describe("정복도", () => {
  it("아는 곳이 없어도 눈금은 보여 준다", () => {
    // 0은 부끄러운 숫자가 아니라 시작점이다. 245라는 분모가 이 게임을 설명한다.
    expect(aggregateConquest(COURSES, mastery({}), 245)).toEqual({
      known: 0,
      total: 245,
      percent: 0,
    });
  });

  it("코스를 가로질러 더한다", () => {
    const m = mastery({ seoul: { known: 18 }, jeju: { known: 2 } });
    expect(aggregateConquest(COURSES, m, 245)).toEqual({ known: 20, total: 245, percent: 8 });
  });

  it("전국 코스도 정복도에 든다", () => {
    // 빼면 그것만 열심히 한 사람의 화면이 계속 0이다.
    const m = mastery({ sido: { known: 17 } });
    expect(aggregateConquest(COURSES, m, 245)?.known).toBe(17);
  });
});

describe("시도별 진행", () => {
  it("손댄 시도만 나온다", () => {
    const m = mastery({ seoul: { known: 18 } });
    expect(sidoProgress(SIDO, m).map((s) => s.name)).toEqual(["서울"]);
  });

  it("코스가 없는 시도는 나오지 않는다", () => {
    // 세종은 시도이면서 그 아래 시군이 없다. 셀 것이 없는 것과 0은 다르다.
    const m = mastery({ seoul: { known: 1 }, jeju: { known: 2 } });
    expect(sidoProgress(SIDO, m).map((s) => s.name)).not.toContain("세종");
  });

  it("비율이 높은 순으로 온다", () => {
    const m = mastery({ seoul: { known: 5 }, jeju: { known: 2 } });
    const rows = sidoProgress(SIDO, m);
    expect(rows.map((s) => s.name)).toEqual(["제주", "서울"]);
    expect(rows[0]).toMatchObject({ known: 2, total: 2, percent: 100 });
    expect(rows[1]).toMatchObject({ known: 5, total: 25, percent: 20 });
  });

  it("아무것도 안 했으면 빈 목록이다", () => {
    expect(sidoProgress(SIDO, mastery({}))).toEqual([]);
  });
});

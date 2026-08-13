import { describe, expect, it } from "vitest";
import { ENTRY_COURSE_ID, pickResumeTarget } from "./resume";
import type { CourseMastery } from "../score/mastery";
import type { CourseSummary } from "./summary";

const COURSES: CourseSummary[] = [
  { id: "sido", name: "전국 17 시도", shortName: "전국", overlapping: false, version: 1, total: 17, sido: "11" },
  { id: "seoul", name: "서울 25개 구", shortName: "서울", overlapping: false, version: 2, total: 25, sido: "11" },
  { id: "gyeonggi", name: "경기도 31 시군", shortName: "경기", overlapping: false, version: 1, total: 31, sido: "41" },
];

function mastery(entries: Record<string, number>): Map<string, CourseMastery> {
  return new Map(
    Object.entries(entries).map(([id, known]) => [
      id,
      {
        courseId: id,
        played: true,
        total: COURSES.find((c) => c.id === id)!.total,
        known,
        stuckCodes: [],
      },
    ]),
  );
}

describe("이어하기가 가리킬 곳", () => {
  it("처음이면 입문 코스에서 시작한다", () => {
    const t = pickResumeTarget(COURSES, new Map(), null);
    expect(t).toMatchObject({ kind: "start", courseId: ENTRY_COURSE_ID });
    expect(t.known).toBeUndefined();
  });

  it("방금 하던 코스에 남은 곳이 있으면 거기다", () => {
    const t = pickResumeTarget(
      COURSES,
      mastery({ seoul: 18, gyeonggi: 3 }),
      { courseId: "seoul", mode: "map", at: 9_000 },
    );
    expect(t).toMatchObject({ kind: "resume", courseId: "seoul", known: 18, total: 25 });
  });

  it("방금 하던 코스를 다 끝냈으면 남은 곳이 가장 많은 코스로 간다", () => {
    const t = pickResumeTarget(
      COURSES,
      mastery({ seoul: 25, gyeonggi: 3 }),
      { courseId: "seoul", mode: "map", at: 9_000 },
    );
    expect(t.courseId).toBe("gyeonggi");
  });

  it("없어진 코스를 가리키는 옛 기록은 무시한다", () => {
    // 저장 계층은 코스 데이터를 모르므로 걸러 줄 수 없다. 여기서 확인한다.
    const t = pickResumeTarget(
      COURSES,
      mastery({ seoul: 18 }),
      { courseId: "atlantis", mode: "map", at: 9_000 },
    );
    expect(t.courseId).toBe("seoul");
  });

  it("마지막 기록이 없어도 해 본 코스가 있으면 이어한다", () => {
    const t = pickResumeTarget(COURSES, mastery({ gyeonggi: 30 }), null);
    expect(t).toMatchObject({ kind: "resume", courseId: "gyeonggi", known: 30 });
  });

  it("전부 정복했으면 입문 코스로 보낸다", () => {
    // 더 채울 곳이 없는 사람에게 남은 일은 다시 도는 것뿐이다.
    const t = pickResumeTarget(
      COURSES,
      mastery({ sido: 17, seoul: 25, gyeonggi: 31 }),
      { courseId: "seoul", mode: "map", at: 9_000 },
    );
    expect(t).toMatchObject({ kind: "resume", courseId: ENTRY_COURSE_ID });
  });

  it("해 본 적 없는 코스로는 이어하지 않는다", () => {
    // 남은 곳이 31로 가장 많지만 손댄 적이 없다.
    const t = pickResumeTarget(COURSES, mastery({ seoul: 18 }), null);
    expect(t.courseId).toBe("seoul");
  });
});

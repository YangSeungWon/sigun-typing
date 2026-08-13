import type { CourseMastery } from "../score/mastery";
import type { LastRun } from "../score/lastRun";
import type { CourseSummary } from "./summary";

/**
 * 처음 온 사람이 갈 곳.
 *
 * 전국 열일곱 시도다. 서울(25구)이 인지도는 높지만 첫 판이 길고, 무엇보다
 * 히어로의 전국 지도와 모양이 다르다 — 방금 본 지도를 그대로 치는 것이
 * 규칙을 가장 빨리 설명한다. 리포가 이 코스를 "가장 짧고 가장 쉬운 입문
 * 코스"로 설계해 둔 것도 같은 이유다.
 *
 * 바꾸려면 여기 한 줄이다.
 */
export const ENTRY_COURSE_ID = "sido";

export interface ResumeTarget {
  /** 처음이면 `시작`, 아니면 `이어하기`. 버튼 글자가 여기서 갈린다. */
  kind: "start" | "resume";
  courseId: string;
  courseName: string;
  total: number;
  /** 해 본 코스일 때만. 처음이면 없다. */
  known?: number;
}

function target(course: CourseSummary, kind: ResumeTarget["kind"], known?: number): ResumeTarget {
  return {
    kind,
    courseId: course.id,
    courseName: course.name,
    total: course.total,
    ...(known === undefined ? {} : { known }),
  };
}

/**
 * `이어하기`가 가리킬 곳.
 *
 * 순서에 근거가 있다.
 *
 *   ① 방금 하던 코스에 남은 곳이 있으면 거기. 사람이 마지막으로 표현한
 *      의사이고, 그걸 무시하고 다른 곳을 권하면 이어하기가 아니다.
 *   ② 아니면 남은 곳이 가장 많은, 해 본 코스. 다 끝낸 코스로 데려가지 않는다.
 *   ③ 해 본 코스가 없으면 입문 코스. 이때만 `시작`이다.
 *   ④ 전부 정복했으면 입문 코스. 더 채울 곳이 없는 사람에게 이어하기를 들이밀
 *      수는 없고, 그렇다고 버튼을 없애면 첫 화면에 할 일이 사라진다. 다시 도는
 *      것이 남은 유일한 일이므로 처음 그 자리로 보낸다.
 *
 * `last.courseId`가 지금도 실재하는 코스인지는 여기서 확인한다 — 저장 계층은
 * 코스 데이터를 모르는 채로 두었으므로 그쪽에서 걸러 줄 수 없다.
 */
export function pickResumeTarget(
  courses: CourseSummary[],
  mastery: Map<string, CourseMastery>,
  last: LastRun | null,
): ResumeTarget {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const remaining = (c: CourseSummary) => {
    const m = mastery.get(c.id);
    return m?.played ? c.total - m.known : 0;
  };

  const lastCourse = last ? byId.get(last.courseId) : undefined;
  if (lastCourse && remaining(lastCourse) > 0) {
    return target(lastCourse, "resume", mastery.get(lastCourse.id)?.known ?? 0);
  }

  const played = courses.filter((c) => mastery.get(c.id)?.played);
  if (played.length === 0) {
    const entry = byId.get(ENTRY_COURSE_ID) ?? courses[0];
    return target(entry, "start");
  }

  // 동점이면 COURSES 순서를 따른다. 정렬이 흔들리면 새로고침마다 다른 곳을 권한다.
  const next = played.reduce((best, c) => (remaining(c) > remaining(best) ? c : best));
  if (remaining(next) > 0) {
    return target(next, "resume", mastery.get(next.id)?.known ?? 0);
  }

  const entry = byId.get(ENTRY_COURSE_ID) ?? courses[0];
  return target(entry, "resume", mastery.get(entry.id)?.known ?? entry.total);
}

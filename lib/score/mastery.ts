import { loadMistakes } from "./mistakes";
import { loadPersonalBest } from "./personalBest";

/**
 * 한 코스에서 내가 아는 곳이 몇 곳인가.
 *
 * `lib/useMastery.ts`가 코스 하나에 대해 하던 추론을 그대로 꺼내 온 것이다.
 * 그쪽은 지도를 칠하려고 `CourseGeo`를 받는데, 첫 화면은 열일곱 코스를 한꺼번에
 * 세면서 지도는 한 장(전국)만 쓴다 — 코스마다 지도 파일을 받아 올 이유가 없다.
 * 그래서 규칙만 여기로 옮기고 `useMastery`는 이것을 부르는 껍데기로 남긴다.
 * 규칙이 두 벌이 되면 코스 화면과 첫 화면이 다른 숫자를 말하게 된다.
 *
 * 추론 방식은 바꾸지 않았다. 어느 지역을 맞혔는지는 저장하지 않으므로,
 * **해 본 코스에서 오답노트에 없는 곳**을 언젠가 맞힌 곳으로 본다.
 *
 * `@/data/courses`를 import하지 않는다. 이 파일은 첫 화면의 클라이언트 쪽에서
 * 불리고, 245개 지역 배열은 거기 갈 이유가 없다 — 필요한 것은 코스마다
 * id·판번호·개수 세 값뿐이다.
 */
export interface CourseRef {
  id: string;
  version: number;
  /** 이 코스에 든 지역 수 */
  total: number;
}

export interface CourseMastery {
  courseId: string;
  /** 기록이 하나라도 있는가. 없으면 아래 숫자는 0이고, 화면은 이 코스를 그리지 않는다. */
  played: boolean;
  total: number;
  known: number;
  stuckCodes: string[];
}

export function readCourseMastery(course: CourseRef): CourseMastery {
  const stuck = loadMistakes(course.id);

  /*
   * 해 본 적이 있는가. 오답이 남아 있거나, 두 모드 중 하나에 개인 기록이 있으면
   * 해 본 것이다. 둘 다 없으면 첫 방문이고 — 첫 방문자의 지도는 색이 없어야 한다.
   */
  const played =
    stuck.length > 0 ||
    (["map", "learn"] as const).some((mode) =>
      loadPersonalBest(course.id, mode, course.version),
    );

  if (!played) {
    return { courseId: course.id, played: false, total: course.total, known: 0, stuckCodes: [] };
  }

  return {
    courseId: course.id,
    played: true,
    total: course.total,
    // 오답노트가 코스보다 길어질 일은 없지만, 옛 판번호의 찌꺼기가 섞이면
    // 음수가 나올 수 있다. 아는 곳이 마이너스인 화면을 만들지 않는다.
    known: Math.max(0, course.total - stuck.length),
    stuckCodes: stuck.map((r) => r.code),
  };
}

export function readAllMastery(courses: CourseRef[]): Map<string, CourseMastery> {
  return new Map(courses.map((c) => [c.id, readCourseMastery(c)]));
}

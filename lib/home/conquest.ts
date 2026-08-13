import type { CourseMastery } from "../score/mastery";
import type { CourseSummary, SidoSummary } from "./summary";

/**
 * 대한민국의 몇 곳을 아는가.
 *
 * 분모는 245 — 시도 열일곱과 시군·구 이백스물여덟을 더한 값이고, 그게 이
 * 서비스에 있는 문제의 전부다. 시도를 빼고 228로 세는 안도 있었는데, 그러면
 * 전국 코스만 정복도에 안 잡혀서 그것만 열심히 한 사람의 화면이 계속 0이다.
 */
export interface Conquest {
  known: number;
  total: number;
  /** 0~100 정수. 소수점은 이 숫자가 답하는 질문("얼마나 왔나")에 필요 없다. */
  percent: number;
}

export function aggregateConquest(
  courses: CourseSummary[],
  mastery: Map<string, CourseMastery>,
  totalRegions: number,
): Conquest | null {
  const known = courses.reduce((sum, c) => sum + (mastery.get(c.id)?.known ?? 0), 0);

  /*
   * 한 곳도 없으면 아무것도 아니다. `0 / 245 · 정복도 0%`는 정보가 아니라
   * 아직 아무것도 안 했다는 말을 숫자로 늘여 놓은 것이고, 첫 화면에서 처음
   * 보는 숫자가 0이면 시작하기 전에 뒤처진 기분부터 준다.
   */
  if (known === 0) return null;

  return {
    known,
    total: totalRegions,
    percent: Math.round((known / totalRegions) * 100),
  };
}

export interface SidoProgress {
  code: string;
  name: string;
  courseId: string;
  known: number;
  total: number;
  percent: number;
}

/**
 * 시도별 진행. 손댄 곳만 돌려준다.
 *
 * 안 해 본 시도까지 0%로 늘어놓으면 열일곱 줄 중 열다섯이 빈 막대가 된다.
 * 그건 진행판이 아니라 아직 안 한 일 목록이다.
 */
export function sidoProgress(
  sido: SidoSummary[],
  mastery: Map<string, CourseMastery>,
): SidoProgress[] {
  return sido
    .flatMap((s) => {
      if (!s.courseId || s.total === 0) return [];
      const known = mastery.get(s.courseId)?.known ?? 0;
      if (known === 0) return [];
      return [{
        code: s.code,
        name: s.name,
        courseId: s.courseId,
        known,
        total: s.total,
        percent: Math.round((known / s.total) * 100),
      }];
    })
    .sort((a, b) => b.percent - a.percent || b.known - a.known || a.name.localeCompare(b.name));
}

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

/*
 * 한 곳도 없어도 숫자를 보여 준다.
 *
 * 한때 0이면 통째로 감추고 카피를 대신 띄웠다. 처음 보는 숫자가 0이면
 * 시작하기도 전에 뒤처진 기분을 준다고 봤기 때문인데, 그러느라 첫 방문자와
 * 재방문자의 첫 화면이 서로 다른 물건이 됐다 — 한쪽은 문장이 맞아 주고
 * 다른 쪽은 계기판이 맞아 준다.
 *
 * 이 게임에서 0은 부끄러운 숫자가 아니라 **눈금의 시작점**이다. 245라는
 * 분모를 먼저 보여 주는 편이 "여기서 무엇을 모으는 것인가"를 문장보다 빨리
 * 설명한다. 대신 처음 온 사람에게는 규칙 한 줄을 함께 둔다 — 그건 카피가
 * 아니라 안내다.
 */
export function aggregateConquest(
  courses: CourseSummary[],
  mastery: Map<string, CourseMastery>,
  totalRegions: number,
): Conquest {
  const known = courses.reduce((sum, c) => sum + (mastery.get(c.id)?.known ?? 0), 0);

  return {
    known,
    total: totalRegions,
    // 분모가 0인 일은 없지만(코스가 열일곱이다) 나눗셈에 기대를 걸지는 않는다.
    percent: totalRegions === 0 ? 0 : Math.round((known / totalRegions) * 100),
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

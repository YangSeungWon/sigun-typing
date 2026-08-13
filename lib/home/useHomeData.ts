"use client";

import { useMemo } from "react";
import { readAllMastery } from "../score/mastery";
import { loadAllMistakes } from "../score/mistakes";
import { loadLastRun } from "../score/lastRun";
import { loadPersonalBest } from "../score/personalBest";
import { pickConfusionPair, type ConfusionPair } from "../score/confusion";
import { useIsHydrated } from "../useIsHydrated";
import { aggregateConquest, sidoProgress, type Conquest, type SidoProgress } from "./conquest";
import { pickResumeTarget, type ResumeTarget } from "./resume";
import type { HomeSeed } from "./summary";

/**
 * 첫 화면이 쓰는 값 전부, 한 군데서.
 *
 * 네 블록(정복도·이어하기·오늘의 도전·헷갈리는 곳)이 같은 기록을 서로 다르게
 * 읽으면 화면 안에서 숫자가 어긋난다. 한 번 모아서 나눠 준다.
 *
 * 전부 이 기기에만 있는 값이라 하이드레이션 뒤에야 읽을 수 있다. 그전에는
 * **서버가 그린 것과 한 글자도 다르지 않은** 값을 돌려준다 — 없는 것을 미리
 * 그려 두었다가 바꾸면 그게 곧 불일치다.
 */
export interface HomeData {
  /** 하이드레이션이 끝나 기기 기록을 읽었는가. */
  ready: boolean;
  /**
   * 늘 있다. 한 곳도 모르면 `0 / 245`다 — 0은 부끄러운 숫자가 아니라 눈금의
   * 시작점이고, 245라는 분모가 이 게임이 무엇을 모으는 것인지 설명한다.
   */
  conquest: Conquest;
  /** 손댄 시도만. 비어 있으면 블록을 그리지 않는다. */
  sidoProgress: SidoProgress[];
  resume: ResumeTarget;
  today: { courseId: string; courseName: string; total: number; bestMs?: number };
  /** 두 번 이상 헷갈린 짝이 있을 때만. 없으면 블록을 그리지 않는다. */
  confusion: ConfusionPair | null;
}

export function useHomeData(seed: HomeSeed): HomeData {
  const hydrated = useIsHydrated();

  return useMemo(() => {
    const today = {
      courseId: seed.today.courseId,
      courseName: seed.today.courseName,
      total: seed.today.total,
    };

    if (!hydrated) {
      return {
        ready: false,
        // 서버가 그린 것과 한 글자도 달라선 안 된다. 기록을 모르면 0이다.
        conquest: { known: 0, total: seed.totalRegions, percent: 0 },
        sidoProgress: [],
        // 서버는 이 기기의 기록을 모른다. 처음 온 사람과 같은 것을 그린다.
        resume: pickResumeTarget(seed.courses, EMPTY_MASTERY, null, seed.today.courseId),
        today,
        confusion: null,
      };
    }

    const mastery = readAllMastery(
      seed.courses.map((c) => ({ id: c.id, version: c.version, total: c.total })),
    );

    const bestMs = loadPersonalBest(
      seed.today.courseId,
      "map",
      seed.today.version,
    )?.elapsedMs;

    return {
      ready: true,
      conquest: aggregateConquest(seed.courses, mastery, seed.totalRegions),
      sidoProgress: sidoProgress(seed.sido, mastery),
      resume: pickResumeTarget(seed.courses, mastery, loadLastRun(), seed.today.courseId),
      today: bestMs === undefined ? today : { ...today, bestMs },
      confusion: pickConfusionPair(loadAllMistakes(seed.courses.map((c) => c.id))),
    };
  }, [hydrated, seed]);
}

const EMPTY_MASTERY = new Map();

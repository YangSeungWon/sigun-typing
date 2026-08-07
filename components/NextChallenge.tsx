"use client";

import Link from "next/link";
import { useMemo } from "react";
import { track } from "@/lib/analytics/track";
import type { ModeId, Score } from "@/lib/game/types";
import { loadMistakes } from "@/lib/score/mistakes";
import { useIsHydrated } from "@/lib/useIsHydrated";

interface NextChallengeProps {
  courseId: string;
  mode: ModeId;
  score: Score;
}

/**
 * 다음 판으로 넘기는 자리.
 *
 * 기능을 더 만드는 대신 이미 있는 것들을 잇는다. 사다리를 한 칸 올려 주는 게
 * 핵심이다 — 이름 보고 쳤으면 이제 이름 없이, 본편에서 틀렸으면 오답만.
 */
export function NextChallenge({ courseId, mode, score }: NextChallengeProps) {
  const hydrated = useIsHydrated();

  const missCount = useMemo(
    () => (hydrated ? loadMistakes(courseId).length : 0),
    [hydrated, courseId],
  );

  const go = (toMode: string) =>
    track({ name: "mode_switch", courseId, mode, toMode });

  // 틀린 게 있으면 그것부터가 다음 할 일이다.
  if (mode !== "single" && missCount > 0) {
    return (
      <Link
        href={`/review/${courseId}`}
        onClick={() => go("review")}
        className="flex flex-col gap-1 rounded-lg border border-sign bg-sign/10 px-5 py-4 transition-colors hover:bg-sign/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="text-lg font-medium">틀린 {missCount}곳, 다시 풀어볼까요?</span>
        <span className="font-mono text-sm text-dim">오답만 연습 →</span>
      </Link>
    );
  }

  // 연습을 마쳤으면 이제 본편이다.
  if (mode === "single" && score.completed > 0) {
    return (
      <Link
        href={`/play/quiz/${courseId}?from=result_cta`}
        onClick={() => go("quiz")}
        className="flex flex-col gap-1 rounded-lg border border-sign bg-sign/10 px-5 py-4 transition-colors hover:bg-sign/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="text-lg font-medium">이제 이름 없이도 가능할까요?</span>
        <span className="font-mono text-sm text-dim">지도 타이핑 도전 →</span>
      </Link>
    );
  }

  // 본편을 깨끗하게 끝냈으면 다음 칸은 시간 압박이다.
  if (mode === "quiz" && score.completed === score.total) {
    return (
      <Link
        href={`/play/timeattack/${courseId}?from=result_cta`}
        onClick={() => go("timeattack")}
        className="flex flex-col gap-1 rounded-lg border border-sign bg-sign/10 px-5 py-4 transition-colors hover:bg-sign/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="text-lg font-medium">60초 안에도 가능할까요?</span>
        <span className="font-mono text-sm text-dim">타임어택 도전 →</span>
      </Link>
    );
  }

  return null;
}

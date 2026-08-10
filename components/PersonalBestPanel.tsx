"use client";

import { useEffect, useState } from "react";
import type { ModeId, Score } from "@/lib/game/types";
import {
  isBetter,
  loadPersonalBest,
  savePersonalBest,
} from "@/lib/score/personalBest";
import { playRecord } from "@/lib/sound";
import { formatClock } from "./Odometer";

interface PersonalBestPanelProps {
  courseId: string;
  mode: ModeId;
  score: Score;
  courseVersion: number;
}

/** 초 단위까지 보여준다 — 0.01초 차이로 갱신되는 재미가 여기서 나온다. */
function formatPrecise(ms: number): string {
  return `${formatClock(ms)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;
}

/**
 * 결과 화면의 개인 최고 기록.
 *
 * 이전 기록은 렌더 전에 한 번만 읽고, 저장은 이펙트에서 한다. 읽기와 쓰기를
 * 같은 시점에 하면 방금 저장한 값을 "이전 기록"으로 보여주게 된다.
 */
export function PersonalBestPanel({
  courseId,
  mode,
  score,
  courseVersion,
}: PersonalBestPanelProps) {
  // 이 화면은 판이 끝난 뒤에만 붙으므로 한 번만 읽으면 된다.
  const [previous] = useState(() => loadPersonalBest(courseId, mode, courseVersion));

  useEffect(() => {
    savePersonalBest(courseId, mode, score, Date.now(), courseVersion);
    /*
     * 기록을 갈아 치웠으면 한 번 더 울린다. 완주 소리가 끝난 뒤에 얹어야
     * 두 소리가 겹쳐 뭉개지지 않는다. 첫 기록에는 울리지 않는다 — 비교할
     * 대상이 없으면 갱신이 아니다.
     */
    if (previous && score.completed > 0 && isBetter(score, previous)) {
      const timer = setTimeout(playRecord, 450);
      return () => clearTimeout(timer);
    }
    // 결과가 확정된 뒤 한 번만 저장한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (score.completed === 0) return null;

  const renewed = !previous || isBetter(score, previous);

  if (!previous) {
    return (
      <p className="rounded-lg border border-sign/40 bg-sign/10 px-4 py-3 font-mono text-base text-ink">
        첫 기록 — {formatPrecise(score.elapsedMs)}
      </p>
    );
  }

  if (!renewed) {
    const gap = score.elapsedMs - previous.elapsedMs;
    return (
      <p className="rounded-lg border border-concrete-deep px-4 py-3 font-mono text-base text-dim">
        내 최고 기록 {formatPrecise(previous.elapsedMs)}
        {previous.completed === score.completed && gap > 0 && (
          <span className="text-ink"> · +{(gap / 1000).toFixed(2)}초</span>
        )}
      </p>
    );
  }

  const gained = previous.elapsedMs - score.elapsedMs;
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border border-sign bg-sign/10 px-4 py-3"
      role="status"
    >
      <span className="font-mono text-sm tracking-[0.18em] text-sign uppercase">
        개인 최고 기록 경신
      </span>
      <span className="font-mono text-base text-ink">
        {formatPrecise(previous.elapsedMs)} → {formatPrecise(score.elapsedMs)}
        {/* 완주 수가 늘어난 갱신에서는 시간 차이가 의미가 없다. */}
        {previous.completed === score.completed && gained > 0 && (
          <span className="ml-2 font-semibold text-sign">
            −{(gained / 1000).toFixed(2)}초
          </span>
        )}
      </span>
      {previous.completed !== score.completed && (
        <span className="font-mono text-sm text-dim">
          완주 {previous.completed} → {score.completed}
        </span>
      )}
    </div>
  );
}

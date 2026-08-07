"use client";

import { useEffect } from "react";
import {
  abandonRunTracking,
  track,
  finishRunTracking,
  flushEvents,
  openRunTracking,
  setRunProgress,
} from "@/lib/analytics/track";
import type { ModeId } from "@/lib/game/types";

interface RunLifecycleProps {
  courseId: string;
  mode: ModeId;
  total: number;
  /** 지금까지 확정한 항목 수 */
  progress: number;
  finished: boolean;
  elapsedMs: number;
  hintsUsed: number;
}

/**
 * 한 판의 시작·진행·끝(또는 이탈)을 계측에 남긴다.
 *
 * 이탈을 세려면 "끝내지 않고 사라진 경우"를 알아야 하는데, 그건 상태가 아니라
 * 사건이다. 그래서 마운트/언마운트에 걸어 둔다 — 언마운트됐는데 끝나지 않았으면
 * 그게 이탈이다. 페이지를 통째로 닫는 경우는 track.ts가 pagehide에서 처리한다.
 */
export function RunLifecycle({
  courseId,
  mode,
  total,
  progress,
  finished,
  elapsedMs,
  hintsUsed,
}: RunLifecycleProps) {
  useEffect(() => {
    openRunTracking({ courseId, mode, total });
    return () => abandonRunTracking();
  }, [courseId, mode, total]);

  useEffect(() => {
    setRunProgress(progress);
  }, [progress]);

  /**
   * 25·50·75% 지점만 남긴다. 항목마다 남기면 코스 하나에 260개가 쌓인다.
   * 어디서 지치는지 보려는 것이지 전 구간을 기록하려는 게 아니다.
   */
  const milestone = total > 0 ? milestoneOf(progress, total) : 0;
  useEffect(() => {
    if (milestone === 0) return;
    track({ name: "game_progress", courseId, mode, progress: milestone, total });
    /*
     * 바로 보낸다. 이탈 이벤트는 창을 통째로 닫는 경우처럼 유실될 수 있는데,
     * 그때 이 이정표가 "어디까지 갔다가 나갔는가"의 마지막 근거가 된다.
     * 묶어서 보내면 이정표도 같은 beacon에 실려 같이 사라진다.
     */
    flushEvents();
    // 같은 이정표를 두 번 남기지 않도록 milestone 값에만 반응한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone]);

  useEffect(() => {
    if (!finished) return;
    // 판이 끝나면 값이 더 바뀌지 않으므로 이 이펙트는 한 번만 돈다.
    finishRunTracking({ courseId, mode, total, progress, elapsedMs, hintCount: hintsUsed });
  }, [finished, courseId, mode, total, progress, elapsedMs, hintsUsed]);

  return null;
}

/** 지금 막 지난 이정표(25·50·75). 아직 없으면 0. */
function milestoneOf(progress: number, total: number): number {
  const pct = (progress / total) * 100;
  if (pct >= 75) return 75;
  if (pct >= 50) return 50;
  if (pct >= 25) return 25;
  return 0;
}

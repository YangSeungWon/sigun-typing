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

  /*
   * 두 상태뿐이다. **깼거나, 못 깼거나.**
   *
   * 전에는 넷이었다 — `첫 기록`, `새 최고 기록 1.20초 단축`, `내 최고 기록보다
   * 0.4초 느림`, `내 최고 기록 00:09.80`. 넷 다 다른 문장이라 결과 화면에서
   * 이 줄이 무슨 종류의 말인지 매번 새로 읽어야 했고, `첫 기록`은 그중에서도
   * 뜻을 짐작해야 하는 말이었다(최고 기록이 없었다는 뜻인데 그렇게 안 읽힌다).
   *
   * 이제 라벨 하나와 시간 하나다. 처음 도는 판도 갱신이다 — 비교할 대상이
   * 없다는 것은 사용자의 사정이지 화면이 설명할 일이 아니다.
   *
   * 못 깬 판에는 **차이 대신 목표**를 적는다. `0.4초 느림`은 이 판에 대한
   * 말이고 다음 판에서 쓸 수 없지만, `내 최고 기록 00:09.80`은 다음에 깨야
   * 할 값이라 그대로 쓸모가 있다.
   */
  if (renewed) {
    return (
      /*
       * 상자를 두르지 않는다. 이건 누르는 것이 아니라 기록에 붙는 해석이다.
       * 테두리를 치면 버튼처럼 보여 무엇이 다음 행동인지가 흐려진다.
       */
      <p
        className="flex flex-wrap items-baseline justify-center gap-x-3 font-mono text-base text-on-sign/80"
        role="status"
      >
        <span className="font-semibold text-sign-accent">새 최고 기록</span>
        <span>{formatPrecise(score.elapsedMs)}</span>
      </p>
    );
  }

  return (
    <p className="font-mono text-base text-on-sign/70">
      {`내 최고 기록 ${formatPrecise(previous.elapsedMs)}`}
    </p>
  );
}

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
   * 숫자를 되풀이하지 않는다. **의미만 더한다.**
   *
   * 바로 위 기록 카드에 이 판의 시간이 크게 적혀 있다. 여기서 같은 숫자를
   * 한 번 더 적으면 화면에 같은 값이 세 번 나오면서(카드·이 줄·버튼) 무엇을
   * 봐야 하는지가 흐려진다. 첫 판에 알려 줄 것은 "이게 네 첫 기록이다"
   * 하나뿐이고, 그 다음부터는 "전보다 나아졌는가"뿐이다.
   */
  if (!previous) {
    return (
      <p className="text-center font-mono text-base text-dim">첫 기록</p>
    );
  }

  // 완주 수가 다르면 시간을 견줄 수 없다. 서로 다른 문제를 푼 셈이다.
  const comparable = previous.completed === score.completed;

  if (!renewed) {
    const gap = (score.elapsedMs - previous.elapsedMs) / 1000;
    return (
      <p className="text-center font-mono text-base text-dim">
        {comparable && gap > 0
          ? `내 최고 기록보다 ${gap.toFixed(2)}초 느림`
          : `내 최고 기록 ${formatPrecise(previous.elapsedMs)}`}
      </p>
    );
  }

  const gained = (previous.elapsedMs - score.elapsedMs) / 1000;
  return (
    /*
     * 상자를 두르지 않는다. 이건 누르는 것이 아니라 읽는 한 줄인데, 테두리를
     * 치면 바로 아래 "한 번 더"와 같은 무게로 보여 무엇이 다음 행동인지가
     * 흐려진다.
     */
    <p className="text-center font-mono text-base text-ink" role="status">
      <span className="font-semibold text-sign">새 최고 기록</span>
      {comparable && gained > 0
        ? ` · ${gained.toFixed(2)}초 단축`
        : ` · 완주 ${previous.completed} → ${score.completed}`}
    </p>
  );
}

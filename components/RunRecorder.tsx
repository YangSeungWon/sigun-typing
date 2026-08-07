"use client";

import { useEffect } from "react";
import type { ItemResult } from "@/lib/game/types";
import { saveRun } from "@/lib/score/mistakes";

interface RunRecorderProps {
  courseId: string;
  results: ItemResult[];
}

/**
 * 끝난 판을 오답노트에 반영한다.
 *
 * 이 컴포넌트는 판이 끝났을 때만 붙는다. 즉 **마운트되었다는 사실 자체가
 * 판이 한 번 끝났다는 뜻**이라, 중복 방지 플래그가 필요 없다.
 *
 * 앞서 Game 안에서 플래그로 막으려다 실패했다. 마지막 항목에서 status가
 * finished가 되는 렌더와 진행 카운터가 오르는 렌더가 갈라져 있어서, 무엇을
 * 키로 잡아도 한 번 더 기록되기 쉬웠다. 조건을 상태가 아니라 수명으로 옮겼다.
 */
export function RunRecorder({ courseId, results }: RunRecorderProps) {
  useEffect(() => {
    saveRun(courseId, results, Date.now());
  }, [courseId, results]);

  return null;
}

"use client";

import { useEffect } from "react";
import type { ItemResult, ModeId } from "@/lib/game/types";
import { saveRun } from "@/lib/score/mistakes";
import { saveLastRun } from "@/lib/score/lastRun";
import type { PeerName } from "@/lib/score/confusion";

interface RunRecorderProps {
  courseId: string;
  mode: ModeId;
  results: ItemResult[];
  /**
   * 같은 코스의 지역 이름들. 오답이 오타인지 다른 곳과의 착각인지 가리는 데 쓴다.
   *
   * 오답노트가 코스 데이터를 모르게 두려고 여기서 넘긴다 — 게임은 이미 목록을
   * 손에 들고 있고, 오답노트를 읽기만 하는 화면은 그 목록을 받을 이유가 없다.
   */
  peers: PeerName[];
}

/**
 * 끝난 판을 기기에 남긴다.
 *
 * 이 컴포넌트는 판이 끝났을 때만 붙는다. 즉 **마운트되었다는 사실 자체가
 * 판이 한 번 끝났다는 뜻**이라, 중복 방지 플래그가 필요 없다.
 *
 * 앞서 Game 안에서 플래그로 막으려다 실패했다. 마지막 항목에서 status가
 * finished가 되는 렌더와 진행 카운터가 오르는 렌더가 갈라져 있어서, 무엇을
 * 키로 잡아도 한 번 더 기록되기 쉬웠다. 조건을 상태가 아니라 수명으로 옮겼다.
 *
 * `마지막 판`도 같은 이유로 여기서 쓴다. 개인 기록 쪽에 붙이면 기록이
 * 좋아졌을 때만 남아서 `이어하기`가 엉뚱한 코스를 가리키고, 판을 포기해도
 * 도는 자리(RunLifecycle)에 붙이면 포기한 코스로 다시 데려간다.
 */
export function RunRecorder({ courseId, mode, results, peers }: RunRecorderProps) {
  useEffect(() => {
    saveRun(courseId, results, Date.now(), peers);
    saveLastRun(courseId, mode, Date.now());
  }, [courseId, mode, results, peers]);

  return null;
}

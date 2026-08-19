"use client";

import { useEffect, useRef } from "react";
import type { ModeId } from "@/lib/game/types";
import { saveRun } from "@/lib/score/mistakes";
import { saveLastRun } from "@/lib/score/lastRun";
import type { Notebook } from "@/lib/score/notebooks";
import { markPlayed } from "@/lib/score/played";
import { addRun } from "@/lib/score/history";

interface RunRecorderProps {
  courseId: string;
  mode: ModeId;
  /**
   * 이 판의 결과를 담을 오답노트들.
   *
   * 보통 한 권이다. 여러 시도를 한꺼번에 도는 코스(전국 시군구)만 여러 권으로
   * 나뉜다 — 어느 코스로 만났든 도봉구를 헷갈린다는 사실은 하나여야 한다.
   * 나누는 규칙은 `lib/score/notebooks.ts`에 있다.
   *
   * 오답노트가 코스 데이터를 모르게 두려고 여기서 받는다 — 게임은 이미 목록을
   * 손에 들고 있고, 오답노트를 읽기만 하는 화면은 그 목록을 받을 이유가 없다.
   */
  notebooks: Notebook[];
  /**
   * 이 판의 성적. 곡선의 점 하나가 된다.
   *
   * 연습 판은 안 넘긴다 — 오답만 골라 푸는 판은 코스 전체와 견줄 수 없어서
   * 곡선에 섞이면 어제보다 빨라진 것처럼 보인다.
   */
  run?: { elapsedMs: number; completed: number; total: number; hintsUsed: number };
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
export function RunRecorder({ courseId, mode, notebooks, run }: RunRecorderProps) {
  /*
   * 붙는 순간의 성적을 그대로 든다.
   *
   * 이 컴포넌트는 판이 끝났을 때만 붙으므로 그때 값이 곧 최종 성적이다. 의존성에
   * 넣으면 안 된다 — 성적은 렌더마다 새 객체라 effect가 다시 돌고, 그러면 한
   * 판이 곡선에 여러 점으로 찍힌다.
   */
  const latest = useRef(run);

  /*
   * 곡선에는 한 번만 찍는다.
   *
   * 다른 저장들(오답노트·마지막 판·해 본 코스)은 덮어쓰기라 두 번 돌아도 같은
   * 결과지만, 이것은 **덧붙이기**다. 개발 모드의 StrictMode가 effect를 두 번
   * 부르면 한 판이 두 점이 된다 — 실제로 그랬다.
   */
  const written = useRef(false);

  useEffect(() => {
    const now = Date.now();
    for (const book of notebooks) saveRun(book.courseId, book.results, now, book.peers);
    /*
     * 끝낸 코스로 표시한다. 오답이 하나도 없으면 노트에 아무것도 안 남는데,
     * 그렇다고 안 해 본 것이 되면 완벽하게 돈 사람의 정복도가 0이 된다.
     */
    markPlayed([courseId, ...notebooks.map((b) => b.courseId)]);
    saveLastRun(courseId, mode, now);
    /*
     * 곡선의 점. 개인 최고 기록은 좋아진 순간만 남으므로 "늘고 있나"에 답하지
     * 못한다 — 지나온 판을 그대로 쌓아 두는 자리가 따로 필요하다.
     */
    const score = latest.current;
    if (score && !written.current) {
      written.current = true;
      addRun({ courseId, mode, at: now, ...score });
    }
  }, [courseId, mode, notebooks]);

  return null;
}

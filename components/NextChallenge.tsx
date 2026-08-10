"use client";

import Link from "next/link";
import { track } from "@/lib/analytics/track";
import type { ModeId, Score } from "@/lib/game/types";

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
  /*
   * 사다리는 한 칸만 남긴다 — **따라치기 → 지도 타이핑**.
   *
   * 예전에는 결과마다 다음 모드를 권했다(틀렸으면 오답 연습, 힌트를 썼으면
   * 실력 테스트, 깨끗하게 끝냈으면 타임어택). 그런데 오답 연습은 이미 결과
   * 화면 맨 위에 큰 버튼으로 있어 같은 말이 두 번이었고, 나머지 둘은 판을
   * 끝낼 때마다 "다음은 이걸 하세요"가 붙는 셈이라 제품이 사람을 계속
   * 밀어내는 느낌이 된다. 모드는 위쪽 코스 화면에서 언제든 고를 수 있다.
   *
   * 따라치기만 예외로 두는 이유: 그 모드는 그 자체가 목적이 아니라 본편을
   * 위한 준비다. 이름을 보며 다 쳐 본 사람에게 "이제 이름 없이"는 권유가
   * 아니라 그 연습의 결론이다.
   */
  if (mode !== "learn" || score.completed === 0) return null;

  return (
    <Link
      href={`/play/map/${courseId}?from=result_cta`}
      onClick={() => track({ name: "mode_switch", courseId, mode, toMode: "map" })}
      className="rounded-lg border border-concrete-deep px-5 py-3 text-center text-base text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      이제 이름 없이 — 지도 타이핑 →
    </Link>
  );
}

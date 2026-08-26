"use client";

import Link from "next/link";
import { useState } from "react";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { dayIndex, quizDate } from "@/lib/daily/pick";
import { isOver, MAX_TRIES, type QuizState } from "@/lib/daily/quiz";
import { loadQuiz } from "@/lib/daily/store";
import { aliveOn, loadStreak } from "@/lib/daily/streak";
import { StreakBadge } from "@/components/daily/StreakBadge";

/**
 * 첫 화면의 오늘의 퀴즈 한 줄.
 *
 * 여태 `오늘의 퀴즈` 이름과 `풀기` 단추뿐이라, 오늘 이미 풀었는지 안 풀었는지가
 * 들어가 봐야만 보였다. 매일 한 번인 게임에서 그건 큰 손해다 — 이미 푼 사람은
 * 헛걸음하고, 안 푼 사람은 오늘 할 일이 남았다는 것을 모른 채 지나간다.
 *
 * 대결 줄과 같은 모양을 지킨다. 자리가 커지면 매일 조용히 있어야 할 것이
 * 매일 말을 건다.
 */
export function DailyLine() {
  /*
   * 오늘 몇 일차인지도, 푼 판도 기기에만 있다. 서버는 모르는 값이라 첫 렌더는
   * 아무것도 모르는 상태로 그린다 — 그래야 서버가 그린 것과 어긋나지 않는다.
   */
  const hydrated = useIsHydrated();
  const [seen, setSeen] = useState<{ day: number; quiz: QuizState; streak: number } | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  if (hydrated && !loaded) {
    setLoaded(true);
    /*
     * 시계를 한 번 읽는다. 이 규칙이 막으려는 것은 렌더마다 값이 흔들리는
     * 경우인데, 여기는 하이드레이션 직후 딱 한 번 지나는 자리다(`loaded`가
     * 막는다). 서버에서 미리 계산해 넘길 수도 없다 — 첫 화면은 미리 구워
     * 두는 페이지라 자정을 넘겨도 구울 때의 날짜가 박힌다.
     */
    // eslint-disable-next-line react-hooks/purity
    const day = dayIndex(Date.now());
    setSeen({ day, quiz: loadQuiz(day), streak: aliveOn(loadStreak(), day) });
  }

  const done = seen ? isOver(seen.quiz) : false;
  const score = seen?.quiz.solved
    ? `${seen.quiz.guesses.length} / ${MAX_TRIES}`
    : `X / ${MAX_TRIES}`;

  return (
    /*
     * **카드가 곧 단추다.**
     *
     * 카드 안에 단추를 하나 두고 있었다. 그러면 그 단추에 이름을 적어야 하고,
     * 카드에도 이름이 있으니 한 카드가 자기 이름을 두 번 댄다. 이름을 단추로
     * 옮겨 봤는데 이번엔 카드와 단추가 따로 놀았다 — 누를 것은 오른쪽 끝
     * 조각뿐인데 그 조각이 카드의 이름을 달고 있다.
     *
     * 카드 전체가 가는 문이면 둘 다 풀린다. 이름은 맨 윗줄에 한 번, 그 아래는
     * 값이고, 누르는 자리는 카드 전체다. 옆 두 칸도 같은 규칙이다.
     */
    <Link
      href="/today"
      className="home-daily relative flex flex-col gap-1 rounded-md bg-paint px-5 py-3.5 shadow-[0_1px_0_0_var(--color-edge)] transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:gap-1.5 lg:p-4"
    >
      {/*
        판면으로 세운다.

        회색 바탕에 회색 테두리만 있으니 줄이 있는지도 안 보였다. 면을 깔고
        안쪽 선을 하나 두르면 이 사이트의 표지판 문법이 되고, 곡률을 낮추면
        어디서나 보는 앱 카드에서 벗어난다.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-1.5 rounded-sm border border-edge"
      />
      <span className="relative font-semibold">오늘의 퀴즈</span>
      <span className="relative flex items-baseline gap-3 font-mono text-sm text-dim">
        {/*
          푼 날에는 성적이, 안 푼 날에는 며칠 문제인지가 온다.

          `하루 한 곳 여섯 번`이라고 적어 두었었다. 그건 값이 아니라 규칙이고,
          규칙은 들어가면 화면이 다 말해 준다.
        */}
        {done ? (
          <span className={seen?.quiz.solved ? "text-sign-deep" : undefined}>{score}</span>
        ) : (
          seen && <span className="tabular-nums">{quizDate(seen.day)}</span>
        )}
        {/* 첫날에는 안 띄운다. 하루짜리 연속은 아무 말도 아니다. */}
        {seen && seen.streak > 1 && <StreakBadge days={seen.streak} />}
      </span>
    </Link>
  );
}

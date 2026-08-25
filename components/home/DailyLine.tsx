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
    <section
      aria-label="오늘의 퀴즈"
      className="home-daily relative flex items-center justify-between gap-4 rounded-md bg-paint px-5 py-3.5 shadow-[0_1px_0_0_var(--color-edge)] lg:flex-col lg:items-stretch lg:gap-2 lg:p-5 lg:pt-4">
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
      {/*
        이름은 단추가 맡는다. `오늘의 퀴즈`를 왼쪽에 적고 오른쪽 단추가
        `풀기`라고 하고 있었는데, 옆 카드 둘도 같은 꼴이라 첫 화면이 카드마다
        이름을 두 번씩 대고 있었다. 눌러서 가는 곳의 이름이 그 카드의 이름이다.

        푼 날과 안 푼 날을 단추로 가르지 않아도 된다(`풀기` / `다시 보기`).
        바로 왼쪽의 값이 이미 가른다 — 안 푼 날은 날짜, 푼 날은 성적이다.
      */}
      <span className="relative flex items-baseline gap-3 lg:flex-col lg:items-start lg:gap-1">
        <span className="flex items-baseline gap-3 font-mono text-sm text-dim lg:text-lg">
          {/*
            푼 날에는 성적이, 안 푼 날에는 몇 번째 문제인지가 온다.

            `하루 한 곳 여섯 번`이라고 적어 두었었다. 그건 값이 아니라 규칙이고,
            규칙은 들어가면 화면이 다 말해 준다. 판 번호는 워들이 같은 자리에
            두는 것이기도 하다 — 매일 새 문제가 나온다는 말을 문장 없이 한다.
          */}
          {done ? (
            <span className={seen?.quiz.solved ? "text-sign-deep" : undefined}>{score}</span>
          ) : (
            seen && <span className="tabular-nums">{quizDate(seen.day)}</span>
          )}
          {/* 첫날에는 안 띄운다. 하루짜리 연속은 아무 말도 아니다. */}
          {seen && seen.streak > 1 && <StreakBadge days={seen.streak} />}
        </span>
      </span>
      <Link
        href="/today"
        aria-label="오늘의 퀴즈 풀기"
        /*
          단추를 채운다. 실선 하나로는 누를 것으로 안 보였다. 초록은 안 쓴다 —
          첫 화면의 초록은 `전국 시작` 하나여야 한다.
        */
        className="relative rounded-sm bg-concrete-deep px-5 py-2 text-center font-medium whitespace-nowrap transition-colors lg:mt-auto hover:bg-dim hover:text-paint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        오늘의 퀴즈
      </Link>
    </section>
  );
}

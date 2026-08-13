"use client";

import { useEffect, useState } from "react";

/**
 * 출발 전 판면.
 *
 * 숫자만 크게 띄우는 것이 아니라 **판을 미리 깔아 둔다.** 빈 화면에 숫자만
 * 튀면 시작하는 순간 화면이 통째로 바뀌지만, 판이 이미 있으면 그 자리에
 * 무엇이 나올지 눈에 익은 채로 첫 문제를 맞는다.
 *
 * 싱글과 멀티가 같은 것을 쓴다. 한때 두 벌이었는데, 그러면 한쪽만 고쳐지는
 * 종류의 물건이 된다 — 실제로 "손을 자판에 올려 두세요"를 싱글에서 지운 뒤에도
 * 멀티에는 남아 있었다.
 *
 * 아무 말도 적지 않는다. 숫자 셋이면 무슨 일이 일어날지 다 전해지고, 자판이
 * 없는 휴대폰에서 "손을 자판에 올려 두세요"는 아예 틀린 말이다. 화면을 못 보는
 * 사람에게는 숫자가 그림이므로 그쪽에만 말로 옮긴다.
 */
export function CountdownPlate({ seconds }: { seconds: number }) {
  return (
    <div className="sign-face relative mx-auto flex w-full max-w-2xl items-center justify-center rounded-2xl px-4 py-6 shadow-[0_3px_0_0_var(--color-sign-deep)] sm:px-10 sm:py-8">
      <span className="pointer-events-none absolute inset-2 rounded-xl border-2 border-on-sign sm:inset-2.5" />
      <span
        // key로 매 초 요소를 다시 붙여 숫자마다 애니메이션이 새로 돈다.
        key={seconds}
        className="count-in relative font-mono text-6xl font-bold tabular-nums text-on-sign sm:text-7xl"
        aria-hidden="true"
      >
        {seconds}
      </span>
      <p className="sr-only" role="status" aria-live="assertive">
        {seconds}초 뒤 시작
      </p>
    </div>
  );
}

/**
 * 서버가 정한 출발 시각까지 남은 초.
 *
 * 멀티에서 각자 자기 브라우저로 셋을 세면 신호를 늦게 받은 사람이 늦게
 * 출발한다. 서버는 **출발 시각 하나**를 방송하고, 각 화면은 그 시각까지
 * 남은 시간을 자기가 센다. 그래야 출발선이 같다.
 */
export function useSecondsUntil(startsAt: number | null): number {
  const left = () =>
    startsAt ? Math.max(0, Math.ceil((startsAt - Date.now()) / 1000)) : 0;
  const [seconds, setSeconds] = useState(left);

  useEffect(() => {
    if (!startsAt) return;
    // 1초보다 촘촘히 본다. 정확히 1초마다 재면 숫자가 한 박자씩 늦게 바뀐다.
    const id = setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((startsAt - Date.now()) / 1000)));
    }, 200);
    return () => clearInterval(id);
  }, [startsAt]);

  return seconds;
}

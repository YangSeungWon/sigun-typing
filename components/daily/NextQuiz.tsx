"use client";

import { useEffect, useState } from "react";
import { KST_OFFSET_MS } from "@/lib/score/period";

/**
 * 다음 문제까지.
 *
 * `내일 새 문제가 나옵니다`라고 적고 있었다. 화면이 자기가 무슨 일을 하는지
 * 해설하는 문장이고, 그런 문장은 아무도 안 읽는다.
 *
 * 워들은 같은 자리에 **카운트다운**을 둔다. 문장이 아니라 값이라 읽는 데 힘이
 * 안 들고, 줄어드는 숫자는 "내일 또 오라"는 말을 하지 않고도 그 일을 한다.
 *
 * 하루의 경계는 KST 자정이다(문제를 고르는 규칙과 같은 기준이어야 한다).
 */
export function NextQuiz() {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const kst = now + KST_OFFSET_MS;
      const midnight = Date.UTC(
        new Date(kst).getUTCFullYear(),
        new Date(kst).getUTCMonth(),
        new Date(kst).getUTCDate() + 1,
      );
      setLeft(midnight - KST_OFFSET_MS - now);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 서버는 지금 몇 시인지 모른다. 하이드레이션 전에는 자리만 지킨다.
  if (left === null) return null;

  const total = Math.max(0, Math.floor(left / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;

  return (
    <span className="flex items-baseline gap-2">
      <span>다음 문제</span>
      <span className="tabular-nums text-ink">{clock}</span>
    </span>
  );
}

"use client";

import type { ReactNode } from "react";

/**
 * 공유 카드의 한 칸.
 *
 * 큰 단추 하나가 아니라 **평평한 선택지들**이다. 어디로 보낼지는 사람마다
 * 다르고, 하나를 크게 두면 나머지가 곁다리로 보인다. 카드 안에 같은 무게로
 * 늘어놓고 고르게 한다.
 *
 * 아이콘 아래에 이름을 적는다. 아이콘만 두면 카카오톡·X는 알아봐도 나머지가
 * 무슨 뜻인지 눌러 봐야 아는 그림이 된다.
 */
export function ShareOption({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span
        /*
         * 마크를 담는 원. 브랜드 색은 여기 배경에만 쓰고 마크 자체는 안 건드린다 —
         * 상표는 상표 그대로 두고, 이 사이트의 톤은 그 주변에서 낸다.
         */
        className="flex size-11 items-center justify-center rounded-full border border-edge"
      >
        {children}
      </span>
      <span className="text-xs font-medium text-dim">{label}</span>
    </button>
  );
}

/** viewBox가 둘 다 24라 한 곳에서 그린다. */
export function BrandMark({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

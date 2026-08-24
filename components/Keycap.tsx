import type { ReactNode } from "react";

/**
 * 키보드 키 모양의 라벨.
 *
 * `Tab — 초성 힌트` 처럼 한 문장으로 쓰면 개발자용 도움말처럼 읽힌다.
 * 키를 물리적 형태로 떼어 놓으면 "무엇을 누르는가"가 먼저 눈에 들어온다.
 */
export function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded border border-edge border-b-2 bg-paint px-1.5 py-0.5 font-mono text-xs text-ink shadow-[0_1px_0_0_var(--color-edge)]">
      {children}
    </kbd>
  );
}

/** 키와 설명을 한 쌍으로. */
export function KeyHint({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Keycap>{keys}</Keycap>
      <span>{children}</span>
    </span>
  );
}

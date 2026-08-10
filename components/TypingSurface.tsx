"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface TypingSurfaceProps {
  /** 입력이 바뀔 때마다 호출 — IME 조합 중 문자열도 그대로 넘어온다 */
  onType: (value: string) => void;
  /** 항목이 확정될 때마다 증가하는 값. 바뀌면 입력창을 비운다. */
  advancedAt: number;
  disabled?: boolean;
  /**
   * 뜨자마자 입력창을 잡을지.
   *
   * 게임 화면에서는 당연히 잡아야 하지만, 홈에서 그러면 페이지를 열자마자
   * 휴대폰 키보드가 올라온다. 읽으러 온 사람에게는 방해다.
   */
  autoFocus?: boolean;
  onFocusChange?: (focused: boolean) => void;
  children: ReactNode;
}

/**
 * 화면에 보이지 않는 입력창을 감싸고, 한글 IME 조합을 안전하게 처리한다.
 *
 * 조합 중에 값을 비우는 것이 이 게임에서 가장 깨지기 쉬운 지점이다.
 * "수원"을 다 쳐서 정답이 확정되는 순간에도 IME는 아직 `원`을 조합 중이라,
 * 값만 지우면 남아 있던 조합이 다음 지역명 앞에 다시 튀어나온다.
 * 그래서 조합 중일 때만 blur/focus로 IME 버퍼를 확실히 끊는다.
 */
export function TypingSurface({
  onType,
  advancedAt,
  disabled,
  autoFocus = true,
  onFocusChange,
  children,
}: TypingSurfaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => onFocusChange?.(focused), [focused, onFocusChange]);

  // 시작할 때와 다시 활성화될 때 포커스를 가져온다.
  useEffect(() => {
    if (!disabled && autoFocus) inputRef.current?.focus();
  }, [disabled, autoFocus]);

  // 항목이 넘어갈 때마다 입력창을 비운다.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.value = "";
    if (composingRef.current) {
      composingRef.current = false;
      el.blur();
      el.focus();
    }
  }, [advancedAt]);

  return (
    <div
      className="relative w-full cursor-text"
      onMouseDown={(e) => {
        // 판면 아무 데나 눌러도 계속 칠 수 있어야 한다.
        e.preventDefault();
        inputRef.current?.focus();
      }}
    >
      {children}
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="지역명 입력"
        /*
         * 판면 전체를 덮는다. 1px짜리로 두면 모바일에서 두 가지가 깨진다 —
         * 브라우저가 포커스된 요소를 화면 안으로 스크롤할 때 엉뚱한 곳으로
         * 맞추고, 탭으로 키보드를 올리기도 어렵다.
         *
         * text-base(16px)도 필요하다. 그보다 작으면 iOS가 입력 시 화면을
         * 확대해 버린다.
         */
        className="absolute inset-0 h-full w-full text-base opacity-0 caret-transparent"
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          onType(e.currentTarget.value);
        }}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

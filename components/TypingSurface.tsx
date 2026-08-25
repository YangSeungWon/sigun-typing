"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface TypingSurfaceProps {
  /** 입력이 바뀔 때마다 호출 — IME 조합 중 문자열도 그대로 넘어온다 */
  onType: (value: string) => void;
  /**
   * 엔진이 들고 있는 값. **이것이 정답이고 입력창은 그림자다.**
   *
   * 한때 "문제가 넘어갈 때 비운다"로 두었는데, 비울 계기를 하나씩 세는 방식은
   * 반드시 어딘가 빠진다. 실제로 빠졌다 — 모르겠어요를 누르면 그 순간 문제가
   * 넘어가므로, 그 **뒤에** 정답을 베껴 쓴 글자는 지울 계기가 없었다. 다음
   * 문제에서 한 글자를 치면 `관악구ㄱ`이 통째로 들어왔다.
   *
   * 그래서 계기를 세지 않는다. 엔진이 비었다고 하는데 입력창에 글자가 남아
   * 있으면, 그 글자는 이 판의 것이 아니므로 지운다.
   */
  value: string;
  /**
   * 항목과 무관하게 입력창을 비워야 하는 순간. 바뀌면 비운다.
   *
   * 카운트다운이 도는 동안에도 이 입력창은 살아 있다(휴대폰에서 자판을 미리
   * 올려 두기 위해서다). 그때 눌린 글자는 이 판의 것이 아니므로 출발선에서
   * 한 번 비운다.
   */
  resetAt?: number;
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
  value,
  resetAt = 0,
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

  /*
   * 엔진과 입력창을 맞춘다.
   *
   * 엔진이 비었다고 할 때만 손댄다. 오답을 냈을 때는 엔진이 틀린 답을 그대로
   * 들고 있으므로(틀린 글자만 고칠 수 있게) 여기서도 지우지 않는다.
   *
   * 조합 중에 값을 지우는 것이 이 게임에서 가장 깨지기 쉬운 지점이다. "수원"을
   * 다 쳐서 정답이 확정되는 순간에도 IME는 아직 `원`을 조합 중이라, 값만
   * 지우면 남아 있던 조합이 다음 지역명 앞에 다시 튀어나온다. 그래서 조합
   * 중일 때만 blur/focus로 IME 버퍼를 확실히 끊는다.
   */
  useEffect(() => {
    const el = inputRef.current;
    if (!el || value !== "" || el.value === "") return;
    el.value = "";
    if (composingRef.current) {
      composingRef.current = false;
      el.blur();
      el.focus();
    }
  }, [value]);

  /*
   * 출발선에서 한 번 더.
   *
   * 세는 동안 눌린 글자는 엔진이 받지 않으므로(아직 판이 아니다) 엔진 값은
   * 내내 비어 있고, 위 규칙은 값이 **바뀔 때만** 돈다. 그래서 시작하는 순간을
   * 따로 신호로 받는다.
   */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.value = "";
    if (composingRef.current) {
      composingRef.current = false;
      el.blur();
      el.focus();
    }
  }, [resetAt]);

  /*
   * 치면 잡는다.
   *
   * 포커스는 판면을 눌렀을 때만 돌아왔다. 지도나 소리 단추처럼 판면 **밖**을
   * 누르면 나가고, 그 뒤로는 아무리 쳐도 화면이 반응하지 않는다. 그래서
   * `표지판을 눌러 계속 입력하세요`라는 줄이 화면에 있었다 — 기능이 못 하는
   * 일을 글로 때우고 있었던 것이다.
   *
   * `keydown` 단계에서 잡으므로 **그 글자부터 들어간다.** 포커스를 옮긴 뒤에
   * 기본 동작(글자 삽입)이 일어나기 때문이고, 그래서 첫 글자를 잃지 않는다.
   *
   * 안 가로채는 자리가 셋이다.
   *   · 다른 입력칸에 손이 가 있을 때(이름 칸 같은 것)
   *   · Ctrl·Meta·Alt가 눌렸을 때 — 브라우저 단축키다
   *   · 단추에 초점이 있고 스페이스나 엔터일 때 — 그건 그 단추를 누르는 것이다
   */
  useEffect(() => {
    if (disabled || !autoFocus) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = inputRef.current;
      const at = document.activeElement;
      if (!el || at === el) return;
      if (at instanceof HTMLElement) {
        if (at.isContentEditable) return;
        const tag = at.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (tag === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
      }
      // 글자 한 자이거나 IME가 삼킨 키. 방향키·탭·기능키는 그대로 둔다.
      if (e.key.length !== 1 && e.key !== "Process") return;
      el.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [disabled, autoFocus]);

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

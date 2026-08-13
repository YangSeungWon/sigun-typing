"use client";

import { useState } from "react";
import { setThemeChoice, themeChoice, type ThemeChoice } from "@/lib/theme";
import { useIsHydrated } from "@/lib/useIsHydrated";

/** 다음으로 넘어갈 순서. 시스템에서 출발해 두 판을 돌고 돌아온다. */
const NEXT: Record<ThemeChoice, ThemeChoice> = {
  system: "dark",
  dark: "light",
  light: "system",
};

const LABEL: Record<ThemeChoice, string> = {
  system: "시스템 설정",
  dark: "어두운 화면",
  light: "밝은 화면",
};

const GLYPH: Record<ThemeChoice, string> = {
  system: "◐",
  dark: "●",
  light: "○",
};

/**
 * 밝게 볼지 어둡게 볼지.
 *
 * 기본은 시스템 설정이고 대부분 그대로 둔다. 이 버튼은 시스템과 다르게 쓰고
 * 싶은 사람을 위한 것이라, 지금 무엇으로 보고 있는지를 글자로 밝히는 대신
 * 표시 하나만 둔다 — 화면이 이미 답을 보여 주고 있다.
 *
 * 누를 때 입력창이 포커스를 잃으면 그 뒤로 타자가 안 먹는다(SoundToggle과 같은
 * 이유). 플레이 화면 옆에도 설 수 있으므로 여기서도 막아 둔다.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const hydrated = useIsHydrated();
  const [choice, setChoice] = useState<ThemeChoice>("system");

  // 서버는 이 값을 모른다. 하이드레이션 뒤에 실제 값으로 맞춘다.
  if (hydrated && choice !== themeChoice()) setChoice(themeChoice());

  /*
   * 하이드레이션 전에도 자리는 지킨다. SoundToggle처럼 null을 돌려주면
   * 버튼이 뒤늦게 나타나면서 옆 요소들이 밀린다 — 저쪽은 플레이 화면 한구석에
   * 혼자 있지만 이건 헤더에 다른 것들과 나란히 서기 때문이다.
   */
  if (!hydrated) {
    return <span className={`inline-block size-8 ${className}`} aria-hidden />;
  }

  const next = NEXT[choice];

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setThemeChoice(next);
        setChoice(next);
      }}
      aria-label={`화면 밝기 — 지금 ${LABEL[choice]}. 누르면 ${LABEL[next]}`}
      className={`inline-flex size-8 items-center justify-center rounded text-base leading-none text-dim transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
    >
      <span aria-hidden>{GLYPH[choice]}</span>
    </button>
  );
}

"use client";

import { useState, type ComponentProps } from "react";
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

/**
 * 무엇을 뜻하는 표시인지 보이게.
 *
 * 그림은 셋이다 — 해(밝게), 달(어둡게), 반달(시스템 설정). 해와 달은 설명 없이
 * 읽히고, 시스템 설정은 둘의 가운데라 반달로 둔다.
 *
 * **글자가 아니라 그림이다.** 한때 이 셋을 글자로 찍었다. 이모지로 번지는 것까지
 * U+FE0E로 막아 뒀는데도, 결국 폰트가 가진 글자에 기대는 방식이라는 게 남았다 —
 * 본문 폰트에 없으면 폴백으로 넘어가고, 그러면 획 굵기도 크기도 옆의 것들과
 * 어긋난다. 실제로 반달이 그랬다. 얇은 조각으로 그려졌다.
 *
 * 인라인 SVG에는 그 의존이 없다. 어디서든 같은 획으로 그려지고, `currentColor`라
 * 버튼의 색 상태(쉼·호버)를 그대로 물려받는다.
 */
function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  const common: ComponentProps<"svg"> = {
    viewBox: "0 0 24 24",
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: "false",
  };

  if (choice === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.25" />
        {/* 빛살 여덟. 네 방향과 그 사이 네 방향. */}
        <path d="M12 2.25v2.1M12 19.65v2.1M2.25 12h2.1M19.65 12h2.1M5.11 5.11l1.49 1.49M17.4 17.4l1.49 1.49M18.89 5.11L17.4 6.6M6.6 17.4l-1.49 1.49" />
      </svg>
    );
  }

  if (choice === "dark") {
    return (
      <svg {...common}>
        {/* 초승달. 원 하나에서 원 하나를 베어 낸 모양이다. */}
        <path d="M20.5 14.4A8.7 8.7 0 0 1 9.6 3.5a8.7 8.7 0 1 0 10.9 10.9Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      {/* 반달. 왼쪽은 비고 오른쪽은 찼다 — 밝음과 어두움의 가운데. */}
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
      className={`inline-flex size-8 items-center justify-center rounded text-ink/75 transition-colors hover:text-sign focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
    >
      <ThemeIcon choice={choice} />
    </button>
  );
}

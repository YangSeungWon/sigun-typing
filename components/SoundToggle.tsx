"use client";

import { useState } from "react";
import { setSoundOn, soundOn } from "@/lib/sound";
import { useIsHydrated } from "@/lib/useIsHydrated";

/**
 * 소리 끄기.
 *
 * 소리를 켤 거면 끄는 길도 같은 화면에 있어야 한다. 설정 페이지에 숨겨 두면
 * 조용히 해야 하는 자리에 있는 사람은 그냥 창을 닫는다.
 *
 * 누를 때 입력창이 포커스를 잃으면 그 뒤로 타자가 안 먹으므로 막아 둔다.
 */
export function SoundToggle() {
  const hydrated = useIsHydrated();
  const [on, setOn] = useState(true);

  // 서버는 이 값을 모른다. 하이드레이션 뒤에 실제 값으로 맞춘다.
  if (hydrated && on !== soundOn()) setOn(soundOn());
  if (!hydrated) return null;

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setSoundOn(!on);
        setOn(!on);
      }}
      aria-label={on ? "소리 끄기" : "소리 켜기"}
      aria-pressed={on}
      className="rounded px-1 text-base leading-none opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}

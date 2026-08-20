/**
 * 이어 온 날.
 *
 * `연속 4일`이라고 적지 않는다. 숫자 하나에 설명을 붙이면 화면이 자기가 무슨
 * 일을 하는지 해설하기 시작하고, 그런 문장은 아무도 안 읽는다. 불꽃 옆의 숫자는
 * 설명 없이 읽히는 관용이라 표시만 두면 된다.
 *
 * 눈으로 못 읽는 사람에게는 그 관용이 없으므로 `aria-label`로 말해 준다 —
 * 걷어 낸 것은 글자지 정보가 아니다.
 */
export function StreakBadge({ days }: { days: number }) {
  return (
    <span
      className="inline-flex items-baseline gap-1 font-mono text-sign-deep"
      role="img"
      aria-label={`${days}일 이어서 풀었습니다`}
    >
      {/*
        불꽃은 작으면 물방울이 된다. 14px에서 후보 넷을 그려 보니 전부 그랬다 —
        꽉 찬 실루엣에 그 크기의 여유가 없다. 18px에 안쪽 갈고리가 있는 모양이면
        불꽃으로 읽힌다.
      */}
      <svg
        viewBox="0 0 24 24"
        className="size-[18px] self-center"
        fill="currentColor"
        aria-hidden
        focusable="false"
      >
        <path d="M12 2c.6 3.2 2.3 4.6 3.7 6.3C17 9.9 18 11.6 18 13.8 18 17.8 15.3 21 12 21s-6-3.2-6-7.2c0-1.7.6-3.1 1.5-4.3.1 1.4.8 2.5 1.9 3.1-.9-3.6.6-7.2 2.6-10.6Z" />
      </svg>
      <span className="tabular-nums">{days}</span>
    </span>
  );
}

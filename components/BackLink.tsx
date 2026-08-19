import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 되돌아가는 길.
 *
 * 한때 `font-mono · uppercase · 넓은 자간`으로 적었다. 영문 인터페이스에서
 * 흔한 라벨 문법인데 한글에는 두 가지가 다 어긋난다 — uppercase는 아무 일도
 * 하지 않고, 0.15em 자간은 `시 군 타 이 핑`처럼 낱글자를 흩어 놓는다.
 * 지명이 낱글자로 흩어지면 이 사이트에서 가장 중요한 것(이름)이 가장 읽기
 * 어려워진다.
 *
 * 도로표지의 문법을 그대로 쓴다 — **화살표 하나와 갈 곳의 이름.** 그게 전부다.
 * 글자는 본문과 같은 산세리프, 자간도 그대로. 모노스페이스는 계기판의 숫자
 * 몫으로 남겨 둔다.
 *
 * 손이 닿으면 화살표가 반 칸 물러난다. 색만 바뀌는 것보다 "이쪽으로 나간다"가
 * 먼저 읽힌다.
 *
 * **홈으로 가는 데는 쓰지 않는다.** 한때 깊이 1 화면(기록·랭킹·이용안내·변천사·
 * 약관)이 전부 `← 시군 타이핑`으로 시작했는데, 전역 셸이 생기고 나서는 넓은
 * 화면에서 헤더 로고 바로 밑에 같은 이름의 링크가 한 줄 더 놓였고 좁은 화면에서는
 * 홈 탭이 엄지 밑에 늘 있었다. 홈은 셸의 몫이다. 여기 남는 것은 셸이 모르는
 * 한 칸 — `/courses/:id`에서 `/courses`로, `/history/:year`에서 `/history`로.
 */
export function BackLink({
  href,
  children,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  /** 좁은 화면에서 글자를 감출 때처럼, 화살표만 남는 경우에 쓴다. */
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      /*
       * 눈에 띄어야 한다. 자간과 모노스페이스를 걷어내자 이번엔 너무 조용해져서,
       * 나가는 길을 찾으려면 화면을 훑어야 했다. 표지판의 글자는 작아도 흐리지
       * 않다 — 색과 굵기로 세운다.
       *
       * font-sans를 명시하는 이유: 플레이 화면의 윗줄은 계기판이라 통째로
       * 모노스페이스인데, 거기 들어가면 지명까지 모노로 끌려간다. 모노는
       * 숫자의 몫이다.
       */
      className="group inline-flex w-fit items-center gap-2 font-sans text-base font-medium text-ink/70 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span
        aria-hidden="true"
        className="transition-transform duration-150 group-hover:-translate-x-0.5"
      >
        ←
      </span>
      {children}
    </Link>
  );
}

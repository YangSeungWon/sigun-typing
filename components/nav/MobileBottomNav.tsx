"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, TAB_ITEMS } from "@/lib/nav";

/**
 * 좁은 화면 아래 탭 바.
 *
 * 넷은 늘 같은 자리에 있다. 기록 탭을 "헷갈린 곳이 있을 때만" 띄우는 안도
 * 있었는데(첫 화면의 NotesLink가 그렇게 동작한다), 탭 바에서는 안 된다 —
 * 칸이 늘고 줄면 나머지 탭의 위치가 엄지 밑에서 움직인다. 빈 방으로 가는
 * 문을 여는 값보다 자리가 고정되는 값이 크다.
 *
 * 판이 도는 화면(/play, /review)에는 이 바가 없다. 그건 이 컴포넌트가
 * 아니라 라우트 구조가 정한다 — app/(site) 안에 있는 것만 셸을 받는다.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      /*
       * pb는 margin이 아니라 padding이어야 한다. 그래야 판면이 iOS
       * 홈 인디케이터 **밑까지** 이어지고, 그 자리에 페이지 색이 띠로 남지 않는다.
       * env()가 0이 아니려면 layout.tsx의 viewportFit: "cover"가 필요하다.
       */
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-paint pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {TAB_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                /*
                  그림과 이름을 함께 둔다.

                  글자만 있을 때는 넷이 같은 회색 낱말이라 엄지가 자리를
                  외우기 전까지 매번 읽어야 했다. 그림은 읽지 않고 알아보는
                  물건이라 그 일을 줄인다.

                  그런데 높이는 줄인다(56 → 48). 그림을 얹으면서 키우면 좁은
                  화면에서 본문이 그만큼 밀리는데, 이 바는 늘 떠 있는 물건이라
                  한 번 차지한 자리를 끝까지 차지한다. 그림 18px에 글자 11px면
                  48 안에 여유가 있다.
                */
                className={`flex h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
                  active ? "text-sign-deep" : "text-dim"
                }`}
              >
                {item.icon && (
                  <svg
                    viewBox="0 0 24 24"
                    className="size-[18px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={item.icon} />
                  </svg>
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

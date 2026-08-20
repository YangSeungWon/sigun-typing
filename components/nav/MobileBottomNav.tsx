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
       * pb는 margin이 아니라 padding이어야 한다. 그래야 반투명한 판면이 iOS
       * 홈 인디케이터 **밑까지** 이어지고, 그 자리에 페이지 색이 띠로 남지 않는다.
       * env()가 0이 아니려면 layout.tsx의 viewportFit: "cover"가 필요하다.
       */
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-concrete-deep bg-paint/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {TAB_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 items-center justify-center text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
                  active ? "text-sign-deep" : "text-dim"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

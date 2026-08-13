"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HEADER_LINKS, isActivePath } from "@/lib/nav";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * 넓은 화면의 윗줄.
 *
 * 이름과 갈 곳들. 여기에 **플레이 방식은 들어가지 않는다** — 지도 타이핑과
 * 이름 보고 익히기는 사이트의 구역이 아니라 코스 하나를 어떻게 할지 정하는
 * 방법이고, 그건 코스를 고른 다음에 나오는 이야기다.
 */
export function DesktopHeader() {
  const pathname = usePathname();

  return (
    <header className="hidden border-b border-concrete-deep md:block">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-3">
        <Link
          href="/"
          className="font-mono text-lg font-medium tracking-[0.2em] transition-colors hover:text-sign focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          SIGUN
        </Link>

        <nav aria-label="주요 메뉴" className="flex items-center gap-5 font-mono text-sm">
          {HEADER_LINKS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  active ? "text-ink" : "text-dim"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle className="-my-1" />
        </nav>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HEADER_LINKS, isActivePath } from "@/lib/nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignMark } from "@/components/nav/SignMark";

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
        {/*
          이름은 하나여야 한다. 여기만 `SIGUN`이었고 나머지 전부 — 제목 template,
          og:siteName, 화면마다의 BackLink — 는 `시군 타이핑`이었다. 그래서 안쪽
          화면에서는 홈으로 가는 문이 위아래로 둘, 이름이 서로 다른 채로 놓였다.

          모노스페이스와 넓은 자간도 걷어낸다. BackLink가 같은 이유로 이미
          걷어낸 것들이다 — 0.2em 자간은 한글을 `시 군 타 이 핑`으로 흩어 놓고,
          이 사이트에서 가장 중요한 것(이름)을 가장 읽기 어렵게 만든다.
          모노는 계기판의 숫자 몫으로 남겨 둔다.
        */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-semibold transition-colors hover:text-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <SignMark className="size-6 shrink-0" />
          시군 타이핑
        </Link>

        {/*
          text-sm이었다. 본문이 16px이고 제목이 48px인 화면에서 14px 메뉴는
          누르는 것이 아니라 주석처럼 읽힌다. 본문과 같아지지는 않을 만큼만
          올린다 — 메뉴는 본문보다 조용해야 하되 안 보여서는 안 된다.
        */}
        <nav aria-label="주요 메뉴" className="flex items-center gap-5 font-mono text-[0.9375rem]">
          {HEADER_LINKS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                /*
                  누를 수 있는 것으로 보여야 한다.
                  화면 전체가 낮은 채도라 링크까지 흐리게 두면 그냥 설명글로
                  읽힌다. 쉬는 상태를 한 단계 올리고, 지금 있는 곳은 색만이
                  아니라 밑줄로도 표시한다 — 색 하나에만 기대면 색을 구별하기
                  어려운 사람에게는 아무 표시도 없는 것과 같다.
                */
                className={`underline-offset-8 transition-colors hover:text-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  active ? "text-ink underline decoration-sign decoration-2" : "text-ink/75"
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

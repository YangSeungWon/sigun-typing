import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * 좁은 화면의 윗줄.
 *
 * 이름과 설정 하나뿐이다. 갈 곳들은 전부 아래 탭 바에 있다 — 엄지가 닿는
 * 곳은 화면 아래고, 위아래 양쪽에 같은 메뉴를 두면 어느 쪽이 진짜인지
 * 매번 고민하게 된다.
 */
export function MobileHeader() {
  return (
    <header className="flex items-center justify-between border-b border-concrete-deep px-5 py-3 md:hidden">
      <Link
        href="/"
        className="font-mono text-base font-medium tracking-[0.2em] transition-colors hover:text-sign focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        SIGUN
      </Link>
      <ThemeToggle className="-my-1" />
    </header>
  );
}

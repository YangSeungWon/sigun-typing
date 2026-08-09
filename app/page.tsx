import Link from "next/link";
import { HomeStatus } from "@/components/HomeStatus";
import { HomeView } from "@/components/HomeView";
import { HomeMap } from "@/components/HomeMap";
import { COURSES, getCourse } from "@/data/courses";
import { DATA_VINTAGE } from "@/data/vintage";
import { loadCourseGeo } from "@/lib/geo";

/**
 * 첫 화면.
 *
 * 이 게임은 설명보다 플레이가 빠르다 — 지도에 한 곳이 켜지고, 이름을 치면
 * 채워진다. 2초면 이해한다. 그래서 홈에서 읽는 시간이 길어질수록 손해다.
 *
 * 한때 타임어택·이름 보고 익히기·실력 테스트·대결을 코스 목록과 함께 첫 화면에 다 늘어놓았다.
 * 하나하나는 있을 이유가 있는 기능이지만, 처음 온 사람에게는 "그래서 뭘
 * 눌러야 하지"가 먼저 생긴다. 나머지 모드는 한 판 끝낸 뒤에 만나도 늦지 않다.
 *
 * 지금 이 화면이 하는 말은 셋뿐이다 — 무슨 게임인가, 지도, 시작.
 */
export default async function Home() {
  const entry = getCourse("sido")!;
  const geo = await loadCourseGeo(entry.id);
  const placeCount = COURSES.reduce((n, c) => n + c.regions.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-6 py-14">
      <HomeView />

      <header className="flex flex-col gap-3">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">시군 타이핑</h1>
        <p className="text-lg text-dim">
          대한민국 지명, 지도만 보고 얼마나 맞힐 수 있을까요?
        </p>
      </header>

      {/*
        설명 대신 지도를 먼저 보여 준다. 이 게임이 무엇인지 한 장이면 된다.
        해 본 사람에게는 같은 지도가 "내가 어디까지 아는가"로 읽힌다.
      */}
      {geo && (
        <div className="flex justify-center">
          <HomeMap geo={geo} courseId={entry.id} />
        </div>
      )}

      <section className="flex flex-col gap-3">
        <Link
          href={`/play/map/${entry.id}?from=home_primary`}
          className="sign-face relative rounded-2xl px-8 py-6 text-center shadow-[0_3px_0_0_var(--color-sign-deep)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="pointer-events-none absolute inset-2.5 rounded-xl border-2 border-paint" />
          <span className="relative block text-2xl font-bold text-paint sm:text-3xl">
            전국 도전 시작
          </span>
          <span className="relative mt-1 block font-mono text-sm text-paint/75">
            17개 시·도 모두 맞히기
          </span>
        </Link>

        <Link
          href="/play/map"
          className="rounded-xl border border-concrete-deep px-6 py-4 text-center font-medium transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          지역 골라서 시작
          <span className="ml-2 font-mono text-sm text-dim">
            {COURSES.length}개 코스
          </span>
        </Link>
      </section>

      {/* 기록이 있는 사람에게만 보인다. 첫 방문자에게 빈 상자를 줄 이유가 없다. */}
      <HomeStatus />

      <nav
        className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-sm text-dim"
        aria-label="더 보기"
      >
        <Link href="/rooms" className="transition-colors hover:text-ink">
          친구와 대결
        </Link>
        <Link href="/ranking" className="transition-colors hover:text-ink">
          랭킹
        </Link>
        <Link href="/notes" className="transition-colors hover:text-ink">
          헷갈리는 지역
        </Link>
        <Link href="/guide" className="transition-colors hover:text-ink">
          이용안내
        </Link>
      </nav>

      <footer className="mt-auto flex flex-col gap-2 border-t border-concrete-deep pt-6 font-mono text-xs text-dim">
        <span>
          코스 {COURSES.length}개 · 지역 {placeCount}곳
        </span>
        <span>
          행정구역 데이터 기준 {DATA_VINTAGE.year} · {DATA_VINTAGE.boundarySource}
        </span>
        <span className="flex gap-4 pt-1">
          <Link href="/privacy" className="transition-colors hover:text-ink">
            개인정보 처리방침
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink">
            이용약관
          </Link>
        </span>
      </footer>
    </main>
  );
}

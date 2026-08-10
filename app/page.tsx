import Link from "next/link";
import { HomeStatus } from "@/components/HomeStatus";
import { HomeView } from "@/components/HomeView";
import { HomeHero } from "@/components/HomeHero";
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
/**
 * 오늘의 한 문제.
 *
 * 날짜에서 고른다 — 무작위로 뽑으면 서버가 그린 것과 브라우저가 그린 것이
 * 달라 화면이 통째로 다시 그려진다. 한국 시간 기준 날짜라 자정에 바뀐다.
 */
function questionOfTheDay(count: number): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const days = Math.floor(kst.getTime() / 86_400_000);
  return days % count;
}

export default async function Home() {
  const entry = getCourse("sido")!;
  const geo = await loadCourseGeo(entry.id);
  const pick = entry.regions[questionOfTheDay(entry.regions.length)];
  const todaysQuestion = {
    code: pick.code,
    name: pick.name,
    aliases: pick.aliases ?? [],
  };

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
        설명 대신 한 문제를 낸다. 지도에 한 곳이 켜지고 이름을 치면 채워지는
        것이 이 게임의 전부인데, 그걸 알려면 지금까지는 코스를 고르고 출발까지
        눌러야 했다. 5초면 이해할 것을 세 번 눌러야 알 수 있었던 셈이다.

        문제는 날마다 바뀐다. 서버와 브라우저가 같은 값을 그려야 하므로
        무작위가 아니라 날짜에서 정한다.
      */}
      {geo && <HomeHero geo={geo} region={todaysQuestion} courseId={entry.id} />}

      {/* 주 버튼은 히어로 안에 있다. 여기는 그 다음 선택지뿐이다. */}
      <section className="flex flex-col gap-3">
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

      {/*
        `헷갈리는 지역`은 여기 두지 않는다. 틀린 곳이 있는 사람에게는 바로
        위 카드가 그 자리로 데려가고, 없는 사람에게 그 링크는 빈 페이지다.
      */}
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
        <Link href="/guide" className="transition-colors hover:text-ink">
          이용안내
        </Link>
      </nav>

      <footer className="mt-auto flex flex-col gap-2 border-t border-concrete-deep pt-6 font-mono text-xs text-dim">
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

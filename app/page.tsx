import Link from "next/link";
import { CourseProgress } from "@/components/CourseProgress";
import { NotesLink } from "@/components/NotesLink";
import { CourseCardThumb } from "@/components/CourseCardThumb";
import { HomeView } from "@/components/HomeView";
import { ThemeToggle } from "@/components/ThemeToggle";
import { COURSES } from "@/data/courses";
import { getScoreRepository } from "@/lib/db/client";
import { SCORING_VERSION } from "@/lib/score/version";
import { COURSE_GROUPS } from "@/data/groups";
import { DATA_VINTAGE } from "@/data/vintage";

/**
 * 첫 화면 = 대한민국 코스 지도.
 *
 * 오래 헤맨 자리다. 한때 여기에 오늘의 문제 미니게임과 `전국 도전 시작`
 * 버튼과 `헷갈리는 지역` 카드가 함께 있었다. 하나하나는 이유가 있었지만
 * 셋이 서로 다른 제품처럼 경쟁했고, 정작 이 서비스의 알맹이인 **코스들**은
 * 한 단계 아래에 숨어 있었다. 화면의 절반이 코스 하나(전국 17 시도)의
 * 홍보였던 셈이다.
 *
 * 이 서비스는 오늘 뭘 할지 추천해 주는 곳이 아니라 지도를 고르고 노는
 * 곳이다. 그런 제품에 들어와서 처음 보고 싶은 것은 "어떤 지도를 할까"이지
 * "당신이 지난번에 틀린 곳"이 아니다. 그래서 목록을 그대로 첫 화면으로
 * 올렸다 — 권역으로 묶인 이 구조 자체가 서비스가 무엇인지 설명한다.
 *
 * 미니게임을 뺀 이유: 규칙을 즉시 이해시키려던 장치였는데, 이름과 화면이
 * 그만큼 분명해진 지금은 값보다 자리값이 크다.
 */
export const metadata = {
  alternates: { canonical: "/" },
};

/*
 * 코스별 1위를 읽어 오므로 완전한 정적 페이지는 아니다. 60초마다 한 번만
 * 다시 만든다 — 순위표는 초 단위로 봐야 할 값이 아니고, 첫 화면은 가장 자주
 * 열리는 자리라 요청마다 DB를 두드릴 이유가 없다.
 */
export const revalidate = 60;

export default async function Home() {
  /*
   * 코스마다 1위 하나씩. 열일곱 번 묻지 않고 한 번에 가져온다.
   *
   * 실패해도 첫 화면은 그려야 한다. 1위는 곁들이는 값이고, 그것 때문에 코스를
   * 고르지 못하게 되는 것은 망가진 것이다 — DB가 잠깐 흔들리거나 개발자가
   * DB 없이 띄웠을 때 홈이 통째로 죽으면 안 된다.
   */
  const bests = await getScoreRepository()
    .bests(
      COURSES.map((c) => ({ courseId: c.id, courseVersion: c.version })),
      "map",
      SCORING_VERSION,
    )
    .catch(() => new Map<string, { elapsedMs: number }>());

  const groups = COURSE_GROUPS.map((group) => ({
    ...group,
    courses: COURSES.filter((c) => c.group === group.id),
  })).filter((g) => g.courses.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-14">
      <HomeView />

      <header className="flex flex-col gap-3">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">시군 타이핑</h1>
        <p className="text-lg text-dim">
          대한민국 지명, 지도만 보고 얼마나 맞힐 수 있을까요?
        </p>
      </header>

      {/* 제목은 자기 아래 카드와 가깝게, 앞 묶음과는 멀게. 그래야 구조가 읽힌다. */}
      {groups.map((group) => (
        <section key={group.id} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-dim">
            {group.name}
          </h2>

          <ul className="flex flex-col gap-2">
            {group.courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-concrete-deep bg-paint/60 p-2 pr-4 transition-colors hover:border-dim hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:gap-5 sm:p-3 sm:pr-5"
                >
                  {/*
                    글자 카드가 아니라 지도 조각으로 읽히게 한다. 이 화면에서는
                    지도가 먼저 눈에 들어오고 글이 그 지도를 설명하는 순서여야 한다.
                  */}
                  <CourseCardThumb
                    courseId={course.id}
                    courseVersion={course.version}
                    total={course.regions.length}
                    className="h-28 w-28 shrink-0 sm:h-32 sm:w-32"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xl font-semibold">{course.name}</span>
                    {/*
                      코스 설명은 여기 두지 않는다.

                      한 장만 보면 좋은 문장인데(`강화에서 내륙을 돌아 남쪽 바다
                      옹진까지`) 열일곱 장이 세로로 쌓이면 문형이 거의 같아서
                      — `A에서 …을 돌아 B까지`가 열일곱 중 열둘 — 리듬이 똑같이
                      울린다. 그러면 눈이 첫 지명만 훑고 지나가 아무것도
                      구별되지 않는다.

                      코스를 열면 제목 아래에 그대로 있다. 거기서는 한 장뿐이라
                      문형이 반복되지 않고, 그게 그 문장이 읽히는 자리다.
                    */}
                    {/*
                      해 본 코스에만 붙는다. 목록을 메뉴가 아니라 진행판으로
                      만드는 한 줄이다 — 다시 온 사람이 어디를 이어서 할지
                      여기서 정한다.
                    */}
                    <CourseProgress
                      courseId={course.id}
                      courseVersion={course.version}
                      total={course.regions.length}
                      topMs={bests.get(course.id)?.elapsedMs}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/*
        전역 메뉴에는 **플레이 방식이 들어가지 않는다.**
        타임어택과 실력 테스트는 사이트의 섹션이 아니라 코스 하나를 어떻게
        할지 정하는 방법이고, 그건 코스를 고른 다음에 나오는 이야기다.
      */}
      <nav
        className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-sm text-dim"
        aria-label="더 보기"
      >
        {/*
          헷갈린 곳이 있는 사람에게만 열리는 문. 여러 코스에 흩어진 것을
          한자리에서 보려면 여기밖에 없다 — 코스를 열면 그 코스 것만 보인다.
        */}
        <NotesLink />
        <Link href="/rooms" className="transition-colors hover:text-ink">
          친구와 대결
        </Link>
        <Link href="/ranking" className="transition-colors hover:text-ink">
          랭킹
        </Link>
        <Link href="/guide" className="transition-colors hover:text-ink">
          이용안내
        </Link>
        {/*
          당장은 여기 말고 둘 자리가 없다. 전역 헤더가 생기면 그리로 옮긴다 —
          화면 밝기는 첫 화면의 기능이 아니라 사이트 전체의 설정이다.
        */}
        <ThemeToggle className="-my-1" />
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

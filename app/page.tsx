import Link from "next/link";
import { CourseProgress } from "@/components/CourseProgress";
import { CourseThumb } from "@/components/CourseThumb";
import { HomeView } from "@/components/HomeView";
import { COURSES } from "@/data/courses";
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

export default function Home() {
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
                  <CourseThumb
                    courseId={course.id}
                    className="h-28 w-28 shrink-0 sm:h-32 sm:w-32"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xl font-semibold">{course.name}</span>
                    {/*
                      이 문장이 카드의 맛이다. 코스를 목록이 아니라 경로로
                      읽게 만든다. 데이터 나열로 바꾸지 않는다.
                    */}
                    <span className="text-base text-dim">{course.description}</span>
                    {/*
                      해 본 코스에만 붙는다. 목록을 메뉴가 아니라 진행판으로
                      만드는 한 줄이다 — 다시 온 사람이 어디를 이어서 할지
                      여기서 정한다.
                    */}
                    <CourseProgress
                      courseId={course.id}
                      courseVersion={course.version}
                      total={course.regions.length}
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

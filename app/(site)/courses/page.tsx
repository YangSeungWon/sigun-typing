import Link from "next/link";
import { CourseProgress } from "@/components/CourseProgress";
import { CourseCardThumb } from "@/components/CourseCardThumb";
import { COURSES } from "@/data/courses";
import { getScoreRepository } from "@/lib/db/client";
import { SCORING_VERSION } from "@/lib/score/version";
import { COURSE_GROUPS } from "@/data/groups";

/**
 * 코스 고르기.
 *
 * 오래 첫 화면이었던 목록이다. 그 자리에 둔 이유는 분명했다 — 이 서비스는
 * 오늘 뭘 할지 추천해 주는 곳이 아니라 지도를 고르고 노는 곳이고, 권역으로
 * 묶인 이 구조 자체가 서비스가 무엇인지 설명한다.
 *
 * 그 설명이 필요한 사람은 처음 온 사람뿐이라는 것이 그 뒤에 드러났다. 두 번째
 * 방문부터는 "어떤 지도가 있나"가 아니라 "어디까지 했더라"가 먼저다. 목록을
 * 없앤 것이 아니라, 늘 첫 장이던 것을 필요할 때 펴는 자리로 옮겼다.
 * 아래 탭에서는 `도전`이다.
 */
export const metadata = {
  title: "코스 고르기",
  alternates: { canonical: "/courses" },
};

/*
 * 코스별 1위를 읽어 오므로 완전한 정적 페이지는 아니다. 60초마다 한 번만
 * 다시 만든다 — 순위표는 초 단위로 봐야 할 값이 아니다.
 *
 * 이 값은 목록을 따라 여기로 왔다. 첫 화면에 두고 오면 이 페이지가 완전
 * 정적이 되어 1위 기록이 빌드 시점에 얼어붙는다.
 */
export const revalidate = 60;

export default async function CoursesPage() {
  /*
   * 코스마다 1위 하나씩. 열일곱 번 묻지 않고 한 번에 가져온다.
   *
   * 실패해도 목록은 그려야 한다. 1위는 곁들이는 값이고, 그것 때문에 코스를
   * 고르지 못하게 되는 것은 망가진 것이다 — DB가 잠깐 흔들리거나 개발자가
   * DB 없이 띄웠을 때 이 화면이 통째로 죽으면 안 된다.
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">코스</h1>

      {/* 제목은 자기 아래 카드와 가깝게, 앞 묶음과는 멀게. 그래야 구조가 읽힌다. */}
      {groups.map((group) => (
        <section key={group.id} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-dim">{group.name}</h2>

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
    </main>
  );
}

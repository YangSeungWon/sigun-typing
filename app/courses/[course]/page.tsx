import Link from "next/link";
import { notFound } from "next/navigation";
import { RegionMap } from "@/components/RegionMap";
import { COURSES, getCourse } from "@/data/courses";
import { loadCourseGeo } from "@/lib/geo";
import { MODE_LABELS } from "@/lib/game/modes";

export function generateStaticParams() {
  return COURSES.map((course) => ({ course: course.id }));
}

/**
 * 코스 소개 페이지.
 *
 * 검색으로 들어오는 사람은 "서울 25개 구 외우기"를 찾지 "시군 타이핑"을
 * 찾지 않는다. 그 사람에게 필요한 건 목록과 지도이고, 그걸 읽다가 바로
 * 게임으로 들어가게 하는 것이 이 페이지의 일이다.
 *
 * 지명을 다 적어 두는 것이 게임의 답을 흘리는 것 아닌가 — 아니다.
 * 여기는 게임 화면이 아니라 자료 화면이고, 애초에 이 목록을 찾으러 온
 * 사람에게 목록을 감추면 페이지가 존재할 이유가 없다. 게임 쪽은 순서를
 * 매번 섞으므로 목록을 외워도 지도를 못 읽으면 못 맞힌다.
 */
export default async function CoursePage({ params }: PageProps<"/courses/[course]">) {
  const { course: courseId } = await params;
  const course = getCourse(courseId);
  if (!course) notFound();

  const geo = await loadCourseGeo(course.id);
  const siblings = COURSES.filter(
    (c) => c.group === course.group && c.id !== course.id,
  ).slice(0, 6);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="font-mono text-xs tracking-[0.15em] text-dim uppercase transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          ← 시군 타이핑
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">{course.name}</h1>
        <p className="text-lg text-dim">{course.description}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/play/quiz/${course.id}?from=course_select`}
          className="rounded-lg bg-sign px-5 py-3 font-medium text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          지도 보고 맞히기
        </Link>
        <Link
          href={`/play/single/${course.id}?from=course_select`}
          className="rounded-lg border border-concrete-deep px-5 py-3 font-medium text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          이름 보고 연습하기
        </Link>
      </div>

      {geo && (
        <div className="flex justify-center">
          <RegionMap geo={geo} variant="route" className="h-64 w-auto sm:h-80" />
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">
          {course.name} 목록 · {course.regions.length}곳
        </h2>
        <ol className="flex flex-wrap gap-2">
          {course.regions.map((region) => (
            <li
              key={region.code}
              className="rounded-lg border border-concrete-deep bg-paint/60 px-3 py-1.5 text-base"
            >
              {region.name}
            </li>
          ))}
        </ol>
        <p className="text-sm text-dim">
          순서는 가나다순이 아니라 인접한 지역을 따라가는 경로입니다.
          게임에서는 매번 다른 순서로 나옵니다.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">이 코스로 할 수 있는 것</h2>
        <ul className="flex flex-col gap-2">
          {(["quiz", "timeattack", "single", "memorize"] as const).map((mode) => (
            <li key={mode}>
              <Link
                href={`/play/${mode}/${course.id}?from=course_select`}
                className="flex items-baseline justify-between gap-4 rounded-lg border border-concrete-deep px-5 py-3 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span className="font-medium">{MODE_LABELS[mode]}</span>
                <span className="text-right text-base text-dim">
                  {MODE_SUMMARY[mode]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {siblings.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">가까운 코스</h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className="inline-block rounded-lg border border-concrete-deep px-4 py-2 text-base transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-auto flex gap-4 border-t border-concrete-deep pt-6 font-mono text-xs text-dim">
        <Link href="/guide" className="transition-colors hover:text-ink">
          이용안내
        </Link>
        <Link href="/ranking" className="transition-colors hover:text-ink">
          랭킹
        </Link>
      </footer>
    </main>
  );
}

const MODE_SUMMARY = {
  quiz: "지도만 보고 이름 맞히기",
  timeattack: "60초 안에 최대한 많이",
  single: "이름을 보며 따라 치기",
  memorize: "힌트 없이 끝까지",
} as const;

export async function generateMetadata({ params }: PageProps<"/courses/[course]">) {
  const { course: courseId } = await params;
  const course = getCourse(courseId);
  if (!course) return {};

  const names = course.regions.map((r) => r.name).join(", ");
  const title = `${course.name} 외우기 — 시군 타이핑`;
  const description = `${course.name} ${course.regions.length}곳을 지도로 익히고 타이핑으로 맞혀 보세요. ${names}`;

  return {
    title,
    // 지명이 다 들어간 설명이 검색에서 이 페이지를 찾게 해 준다.
    description: description.slice(0, 300),
    openGraph: {
      title,
      description: course.description,
      url: `/courses/${course.id}`,
      images: ["/og.png"],
    },
  };
}

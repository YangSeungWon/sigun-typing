import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseMistakes } from "@/components/CourseMistakes";
import { CourseMap } from "@/components/CourseMap";
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
 * 다만 지명 목록은 **접어 둔다.** 본편이 "지도만 보고 떠올리기"인데 시작
 * 버튼 옆에 답이 다 적혀 있으면 규칙이 스스로를 부정한다. 검색으로 목록을
 * 찾아온 사람은 한 번 눌러서 펼치면 되고, 게임을 하러 온 사람은 실수로
 * 답을 보게 되지 않는다. 문구를 "미리 보기"가 아니라 "지역 목록 보기"로
 * 둔 것도 같은 이유다 — 미리 보기는 게임 전에 보는 것이 권장되는 말이다.
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

      {geo && (
        <div className="flex justify-center">
          <CourseMap geo={geo} courseId={course.id} />
        </div>
      )}

      {/*
        기본 플레이 하나만 크게 둔다.
        넷을 같은 크기의 카드로 늘어놓으면 처음 온 사람은 무엇이 본 게임인지
        모른다. `경기도를 한다 → 기본은 지도 보고 맞히기 → 필요하면 다른
        방식도 있다`라는 위계가 읽혀야 한다.

        버튼에는 모드명(`지도 타이핑`) 대신 하는 일을 적는다. 모드명은
        제품 안에서 쓰는 이름이고, 버튼에서는 기능명처럼 보인다.
      */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/play/map/${course.id}?from=course_select`}
          className="rounded-xl bg-sign px-6 py-4 text-center text-xl font-bold text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          지도 보고 맞히기
        </Link>
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-sm text-dim">
          {(["timeattack", "learn", "test"] as const).map((mode) => (
            <li key={mode}>
              <Link
                href={`/play/${mode}/${course.id}?from=course_select`}
                title={MODE_SUMMARY[mode]}
                className="transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {MODE_LABELS[mode]}
              </Link>
            </li>
          ))}
        </ul>
        <CourseMistakes courseId={course.id} />
      </div>

      <details className="group flex flex-col gap-4 rounded-xl border border-concrete-deep px-5 py-3">
        <summary className="cursor-pointer list-none text-base text-dim marker:content-none">
          <span className="flex items-center justify-between gap-4">
            지역 목록 보기 · {course.regions.length}곳
            <span className="transition-transform group-open:rotate-90">›</span>
          </span>
        </summary>
        <ol className="flex flex-wrap gap-2 pt-3">
          {course.regions.map((region) => (
            <li
              key={region.code}
              className="rounded-lg border border-concrete-deep bg-paint/60 px-3 py-1.5 text-base"
            >
              {region.name}
            </li>
          ))}
        </ol>
      </details>

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
  map: "지도만 보고 이름 맞히기",
  timeattack: "60초 안에 최대한 많이",
  learn: "이름을 보며 따라 치기",
  test: "힌트 없이 끝까지",
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

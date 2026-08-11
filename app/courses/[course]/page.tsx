import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseMistakes } from "@/components/CourseMistakes";
import { CourseMap } from "@/components/CourseMap";
import { COURSES, getCourse } from "@/data/courses";
import { COURSE_GROUPS } from "@/data/groups";
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
  const groupName =
    COURSE_GROUPS.find((g) => g.id === course.group)?.name ?? "다른 코스";

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
        {/*
          다른 방식은 셋 다 링크다.
          한때 너무 조용해서 링크인 줄 모르고 지나갈 수 있었다. 그렇다고 테두리를
          씌우면 다시 네 모드가 경쟁하는 화면으로 돌아간다 — 이 화면의 위계는
          `기본 하나 / 보조 셋`이다. 그래서 상자 대신 글자색만 한 단계 올리고,
          손이 닿으면 밑줄로 답한다. 구분 기호도 두지 않는다. 간격이 이미
          셋을 갈라 놓고 있고, 가운뎃점은 이 화면의 언어가 아니다.
        */}
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 font-mono text-sm text-ink/70">
          {(["timeattack", "learn", "test"] as const).map((mode) => (
            <li key={mode}>
              <Link
                href={`/play/${mode}/${course.id}?from=course_select`}
                title={MODE_SUMMARY[mode]}
                className="underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {MODE_LABELS[mode]}
              </Link>
            </li>
          ))}
        </ul>
        <CourseMistakes courseId={course.id} />
      </div>

      {/*
        지역 목록은 액션이 아니라 도구다.
        테두리 상자에 넉넉한 여백까지 두었더니 면적만으로는 CTA와 비슷해져,
        보조 모드보다 더 눌러야 할 것처럼 보였다. 위계를 면적에서도 맞춘다 —
        한 줄짜리 선반으로 낮추고, 개수는 가운뎃점으로 잇는 대신 오른쪽에 붙인다.
      */}
      <details className="group flex flex-col border-y border-concrete-deep py-2">
        <summary className="cursor-pointer list-none text-sm text-dim marker:content-none">
          <span className="flex items-center justify-between gap-4">
            지역 목록 보기
            <span className="flex items-center gap-3 font-mono tabular-nums">
              {course.regions.length}곳
              <span className="transition-transform group-open:rotate-90">›</span>
            </span>
          </span>
        </summary>
        {/*
          이름은 상자에 담지 않는다. 스물다섯 개의 둥근 칸이 늘어서면
          지명이 아니라 태그처럼 읽힌다. 지도책의 색인처럼 줄만 세운다.
        */}
        <ol className="grid grid-cols-2 gap-x-6 gap-y-1 pt-3 text-base sm:grid-cols-4">
          {course.regions.map((region) => (
            <li key={region.code}>{region.name}</li>
          ))}
        </ol>
      </details>

      {siblings.length > 0 && (
        <section className="flex flex-col gap-3">
          {/*
            "가까운 코스"는 무엇이 가까운지 말하지 않는다 — 지리인지 난이도인지
            다음 추천인지. 여기 묶이는 기준은 실제로 권역 하나이므로 그 이름을
            그대로 쓴다. 서울을 보고 있으면 `수도권`이다.
          */}
          <h2 className="text-xl font-semibold">{groupName}</h2>
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

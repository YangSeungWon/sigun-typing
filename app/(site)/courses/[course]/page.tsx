import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { CourseMistakes } from "@/components/CourseMistakes";
import { CourseMap } from "@/components/CourseMap";
import { COURSES, getCourse } from "@/data/courses";
import { COURSE_GROUPS } from "@/data/groups";
import { loadCourseGeo } from "@/lib/geo";
import { MODE_LABELS } from "@/lib/game/modes";
import dongHistoryIds from "@/data/timelapse/dong-history-ids.json";

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

  /*
   * 이 코스의 지역 중 읍면동 코스가 따로 있는 곳.
   *
   * 코드로는 못 잇는다 — 우리 지역 코드는 행정표준코드(종로구 11110)이고
   * 읍면동 코스의 접두사는 원본 경계 파일의 옛 코드(11010)다. 대신 읍면동
   * 코스가 자기 부모 이름을 통째로 들고 있으므로(`서울특별시 종로구`)
   * 그것으로 맞춘다.
   */
  const deeper = new Map(
    COURSES.filter((c) => c.level === "dong" && c.parentName)
      .map((c) => [c.parentName!, c] as const)
      .flatMap(([parent, c]) => {
        const region = course.regions.find((r) => `${course.parentName} ${r.name}` === parent);
        return region ? [[region.code, c] as const] : [];
      }),
  );

  const geo = await loadCourseGeo(course.id);
  /*
   * 옆에 놓을 코스는 **같은 층에서만** 고른다.
   *
   * 권역만 보면 종로구 17개 동 옆에 서울 25개 구와 경기도 31 시군이 선다.
   * 층이 다른 코스는 옆이 아니라 위아래라, 나란히 놓으면 크기를 견주게 된다.
   *
   * 읍면동은 한 권역에 수십 개라 이름만으로는 어디 것인지 알 수 없다.
   * 그래서 같은 시도 안에서만 고른다 — 종로구 옆에는 서울의 다른 구가 온다.
   */
  const siblings = COURSES.filter(
    (c) =>
      c.id !== course.id &&
      c.level === course.level &&
      (course.level === "dong"
        ? c.parentName?.split(" ")[0] === course.parentName?.split(" ")[0]
        : c.group === course.group),
  ).slice(0, 6);

  const groupName =
    course.level === "dong"
      ? (course.parentName?.split(" ")[0] ?? "다른 코스")
      : (COURSE_GROUPS.find((g) => g.id === course.group)?.name ?? "다른 코스");

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-3">
        {/* 이 화면의 부모는 이제 첫 화면이 아니라 목록이다. */}
        <BackLink href="/courses">코스</BackLink>
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
          /*
            폭을 화면 끝까지 늘리지 않는다. 가로로 꽉 찬 초록 띠는 게임을
            시작하는 문이 아니라 웹 폼의 제출 바처럼 읽힌다. 위의 지도와
            비슷한 폭으로 세워 두면 둘이 한 덩어리로 묶인다.
          */
          className="mx-auto w-full max-w-md rounded-xl bg-sign px-6 py-4 text-center text-xl font-bold text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          지도 보고 맞히기
        </Link>
        {/*
          판은 둘뿐이다 — 진짜 하는 것과 연습.

          그래서 **같은 폭으로 쌓는다.** 큰 판 아래 작은 칩 하나가 붙어 있으면
          빼먹은 것처럼 보인다. 폭이 같으면 여기가 "둘 중 하나 고르는 자리"라는
          것이 모양만으로 읽히고, 연습이 부가 옵션이 아니라 다른 하나의 길이 된다.
          무게는 색과 굵기로만 가른다 — 채운 초록이 본편, 테두리만 있는 것이 연습.

          설명은 붙이지 않는다. `이름을 보며 따라 치기`라고 적어 두었는데,
          이름에 이미 "이름 보고"가 들어 있어 같은 말을 두 번 하는 것이었다.
        */}
        <Link
          href={`/play/learn/${course.id}?from=course_select`}
          className="mx-auto block w-full max-w-md rounded-xl border border-concrete-deep px-6 py-3 text-center text-base transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {MODE_LABELS.learn}
        </Link>
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
          {course.regions.map((region) => {
            /*
             * 그 지역의 읍면동 코스가 있으면 이름이 링크가 된다.
             *
             * 읍면동 252개를 목록으로 늘어놓지 않는 대신 여기서 내려간다.
             * 자기 동네를 아는 사람은 이미 그 구를 보고 있고, 모르는 사람에게는
             * 그냥 지명 한 줄로 남는다 — 권하지 않되 막지도 않는다.
             */
            const down = deeper.get(region.code);
            if (!down) return <li key={region.code}>{region.name}</li>;
            return (
              <li key={region.code}>
                <Link
                  href={`/courses/${down.id}`}
                  className="underline decoration-concrete-deep underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {region.name}
                </Link>
              </li>
            );
          })}
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

      {/*
        이 동네가 어떻게 바뀌어 왔는지.
        전국 변천사에는 안 올린다 — 성북구 동 통폐합은 온 나라가 겪은 일이
        아니라 그 동네의 일이다. 대신 그 동네를 보고 있는 사람에게만 보인다.
      */}
      {(dongHistoryIds as string[]).includes(course.id) && (
        <Link
          href={`/history/dong/${course.id}`}
          className="flex items-center justify-between gap-4 border-y border-concrete-deep py-3 text-base transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
        >
          이 동네는 이렇게 나뉘어 왔습니다
          <span className="text-dim">›</span>
        </Link>
      )}

      {/* 이용안내와 랭킹은 헤더에 있다. 같은 링크를 위아래로 두 번 두지 않는다. */}
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<"/courses/[course]">) {
  const { course: courseId } = await params;
  const course = getCourse(courseId);
  if (!course) return {};

  const names = course.regions.map((r) => r.name).join(", ");
  /*
   * "외우기"만으로는 검색어 하나에 걸린다. "지도 게임"을 함께 두어 지역
   * 이름을 외우려는 사람과 지도 게임을 찾는 사람이 같은 페이지에 닿게 한다.
   * 뒤의 "— 시군 타이핑"은 루트 layout의 template이 붙인다.
   */
  const title = `${course.name} 외우기 · 지도 게임`;
  const description = `${course.name} ${course.regions.length}곳을 지도로 익히고 타이핑으로 맞혀 보세요. ${names}`;

  return {
    title,
    // 지명이 다 들어간 설명이 검색에서 이 페이지를 찾게 해 준다.
    description: description.slice(0, 300),
    openGraph: {
      // 공유 카드에는 template이 닿지 않으므로 이름을 직접 붙인다.
      title: `${title} — 시군 타이핑`,
      description: course.description,
      url: `/courses/${course.id}`,
      images: ["/og.png"],
    },
  };
}

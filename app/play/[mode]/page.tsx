import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseThumb } from "@/components/CourseThumb";
import { COURSES } from "@/data/courses";
import { COURSE_GROUPS } from "@/data/groups";
import {
  isModeId,
  MODES,
  MODE_HINTS,
  MODE_LABELS,
  MODE_LADDER,
} from "@/lib/game/modes";

export function generateStaticParams() {
  return Object.keys(MODES).map((mode) => ({ mode }));
}

/** 모드를 바꾸면 카드에서도 한 군데는 달라져야 한다. */
const MODE_TAG: Record<string, string> = {
  timeattack: "60초",
  learn: "순서대로",
  test: "힌트 없이",
};

export async function generateMetadata({ params }: PageProps<"/play/[mode]">) {
  const { mode } = await params;
  if (!isModeId(mode)) return {};
  return {
    title: `${MODE_LABELS[mode]} — 시군 타이핑`,
    description: MODE_HINTS[mode],
  };
}

/** 모드를 고른 뒤 어디를 달릴지 고르는 화면. 권역으로 묶어 목록이 평평해지지 않게 한다. */
export default async function CoursePickerPage({
  params,
}: PageProps<"/play/[mode]">) {
  const { mode } = await params;
  if (!isModeId(mode)) notFound();

  // 멀티는 방을 먼저 만들어야 하므로 이 화면을 거치지 않는다.
  if (mode === "multi") notFound();

  const groups = COURSE_GROUPS.map((group) => ({
    ...group,
    courses: COURSES.filter((c) => c.group === group.id),
  })).filter((g) => g.courses.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="font-mono text-sm tracking-[0.12em] text-dim uppercase transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          ← 시군 타이핑
        </Link>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {MODE_LABELS[mode]}
        </h1>
        <p className="text-dim">{MODE_HINTS[mode]}</p>
      </header>

      {/*
        코스 목록까지 내려온 사람이 모드를 바꾸려고 홈으로 되돌아갈 이유는 없다.
        네 모드가 같은 코스 목록을 공유하므로 여기서 갈아탈 수 있게 한다.
      */}
      {/*
        넷 다 테두리를 두르면 설정 패널처럼 보인다. 지금 고른 것만 물성을
        갖고 나머지는 조용한 글자로 둔다 — 이 화면의 주인공은 모드 선택기가
        아니라 아래 코스 지도다.

        좁은 화면에서는 줄바꿈 대신 가로로 흐르게 한다. 네 개가 두 줄로
        접히면 그것대로 덩어리가 커진다.
      */}
      <nav
        className="-mx-6 flex gap-1 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="모드 고르기"
      >
        {MODE_LADDER.map((m) => (
          <Link
            key={m}
            href={`/play/${m}`}
            aria-current={m === mode ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-base whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              m === mode
                ? "bg-sign-deep font-medium text-paint"
                : "text-ink/60 hover:bg-concrete-deep hover:text-ink"
            }`}
          >
            {MODE_LABELS[m]}
          </Link>
        ))}
      </nav>

      <p className="flex items-center gap-4 font-mono text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-sign" aria-hidden="true" />
          시작
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full border-2 border-sign"
            aria-hidden="true"
          />
          끝
        </span>
      </p>

      {/* 제목은 자기 아래 카드와 가깝게, 앞 묶음과는 멀게. 그래야 구조가 읽힌다. */}
      {groups.map((group) => (
        <section key={group.id} className="flex flex-col gap-2">
          <h2 className="font-mono text-sm tracking-[0.18em] text-ink/70 uppercase">
            {group.name}
          </h2>

          <ul className="flex flex-col gap-2">
            {group.courses.map((course) => {
              return (
                <li key={course.id}>
                  <Link
                    href={`/play/${mode}/${course.id}?from=course_select`}
                    className="group flex items-center gap-4 rounded-xl border border-concrete-deep bg-paint/60 p-2 pr-4 transition-colors hover:border-dim hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:gap-5 sm:p-3 sm:pr-5"
                  >
                    {/*
                      글자 카드가 아니라 지도 조각으로 읽히게 한다.
                      이 화면에서는 지도가 먼저 눈에 들어오고 글이 그 지도를
                      설명하는 순서여야 한다.
                    */}
                    <CourseThumb
                      courseId={course.id}
                      className="h-28 w-28 shrink-0 sm:h-32 sm:w-32"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-xl font-semibold">{course.name}</span>
                        {/*
                          곳 수는 이미 코스 이름에 들어 있다(전국 17 시도).
                          이 자리는 지금 고른 모드가 무엇을 요구하는지에 쓴다 —
                          모드를 바꿨는데 목록이 그대로면 무엇이 달라졌는지
                          알 수 없다.
                        */}
                        {MODE_TAG[mode] && (
                          <span className="font-mono text-sm text-dim">
                            {MODE_TAG[mode]}
                          </span>
                        )}
                      </span>
                      {/*
                        이 문장이 카드의 맛이다. 코스를 목록이 아니라 경로로
                        읽게 만든다. 데이터 나열로 바꾸지 않는다.
                      */}
                      <span className="text-base text-dim">{course.description}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}

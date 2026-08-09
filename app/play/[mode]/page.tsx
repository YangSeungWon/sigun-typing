import Link from "next/link";
import { notFound } from "next/navigation";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-14">
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
      <nav className="flex flex-wrap gap-2" aria-label="모드 고르기">
        {MODE_LADDER.map((m) => (
          <Link
            key={m}
            href={`/play/${m}`}
            aria-current={m === mode ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              m === mode
                ? "bg-ink text-paint"
                : "border border-concrete-deep text-dim hover:bg-concrete-deep hover:text-ink"
            }`}
          >
            {MODE_LABELS[m]}
          </Link>
        ))}
      </nav>

      {groups.map((group) => (
        <section key={group.id} className="flex flex-col gap-3">
          <h2 className="font-mono text-sm tracking-[0.18em] text-dim uppercase">
            {group.name}
          </h2>

          <ul className="flex flex-col gap-3">
            {group.courses.map((course) => {
              return (
                <li key={course.id}>
                  <Link
                    href={`/play/${mode}/${course.id}?from=course_select`}
                    className="flex flex-col gap-2 rounded-xl border border-concrete-deep bg-paint/60 p-5 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-xl font-semibold">{course.name}</span>
                      <span className="font-mono text-sm tabular-nums text-dim">
                        {course.regions.length}곳
                      </span>
                    </div>
                    {/*
                      지명 미리보기를 뺐다. 가린 모드에서 답의 일부를 미리
                      보여 주는 셈이었고, 목록이 필요한 사람은 코스 소개
                      페이지에서 전부 볼 수 있다.

                      총 타수도 뺐다. 코스를 고르는 데 쓰는 값이 아니다.
                    */}
                    <span className="text-base text-dim">{course.description}</span>
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

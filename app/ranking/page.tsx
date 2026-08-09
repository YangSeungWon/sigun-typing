import Link from "next/link";
import { COURSES, getCourse } from "@/data/courses";
import { getScoreRepository } from "@/lib/db/client";
import { SCORING_VERSION } from "@/lib/score/version";
import {
  isRankingPeriod,
  PERIOD_LABELS,
  periodStart,
  RANKING_PERIODS,
} from "@/lib/score/period";
import { MyStanding } from "@/components/MyStanding";
import { MODE_LABELS, MODE_LADDER } from "@/lib/game/modes";
import { isModeId } from "@/lib/game/modes";
import type { ModeId } from "@/lib/game/types";

/** 순위는 항상 지금 상태를 보여줘야 하므로 캐시하지 않는다. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "랭킹 — 시군 타이핑",
  description: "코스별 타수 순위. 서버에서 검증한 기록만 오릅니다.",
};

/** 난이도 사다리 순서를 그대로 쓴다. */
const BOARD_MODES = MODE_LADDER;

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default async function RankingPage({
  searchParams,
}: PageProps<"/ranking">) {
  const params = await searchParams;
  const rawCourse = typeof params.course === "string" ? params.course : "";
  const rawMode = typeof params.mode === "string" ? params.mode : "";
  const rawPeriod = typeof params.period === "string" ? params.period : "";

  const course = getCourse(rawCourse) ?? COURSES[0];
  const mode: ModeId = isModeId(rawMode) ? rawMode : "learn";
  const period = isRankingPeriod(rawPeriod) ? rawPeriod : "all";
  const href = (over: Record<string, string>) =>
    `/ranking?${new URLSearchParams({ course: course.id, mode, period, ...over })}`;

  const entries = await getScoreRepository().leaderboard(
    course.id,
    mode,
    30,
    SCORING_VERSION,
    course.version,
    // force-dynamic 서버 컴포넌트라 요청마다 한 번 평가된다. 이 규칙이 막으려는
    // 것은 클라이언트 재렌더 때마다 값이 흔들리는 경우이고, 여기서는 요청 시각을
    // 읽는 것이 의도한 동작이다.
    // eslint-disable-next-line react-hooks/purity
    periodStart(period, Date.now()),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="font-mono text-sm tracking-[0.12em] text-dim uppercase transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          ← 시군 타이핑
        </Link>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">랭킹</h1>
        <p className="text-dim">
          서버에서 다시 계산해 검증한 기록만 올라갑니다. 채점 규칙이 같은 기록끼리만
          비교합니다.
        </p>
      </header>

      <nav className="flex flex-col gap-4" aria-label="순위표 고르기">
        <div className="flex flex-wrap gap-2">
          {COURSES.map((c) => (
            <Link
              key={c.id}
              href={href({ course: c.id })}
              aria-current={c.id === course.id ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                c.id === course.id
                  ? "bg-sign text-paint"
                  : "border border-concrete-deep text-ink hover:bg-concrete-deep"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {BOARD_MODES.map((m) => (
            <Link
              key={m}
              href={href({ mode: m })}
              aria-current={m === mode ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                m === mode
                  ? "bg-expressway text-paint"
                  : "border border-concrete-deep text-ink hover:bg-concrete-deep"
              }`}
            >
              {MODE_LABELS[m]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {RANKING_PERIODS.map((p) => (
            <Link
              key={p}
              href={href({ period: p })}
              aria-current={p === period ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                p === period
                  ? "bg-ink text-paint"
                  : "border border-concrete-deep text-dim hover:bg-concrete-deep hover:text-ink"
              }`}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </nav>

      {/*
        전체 상위권보다 이쪽이 먼저다. 1위가 18초이고 내가 2분이면 상위권은
        남의 이야기지만, 바로 위 한 줄은 따라잡을 수 있는 거리다.
      */}
      <MyStanding courseId={course.id} courseVersion={course.version} mode={mode} />

      {entries.length === 0 ? (
        // 빈 화면은 상태 보고가 아니라 다음 행동을 권하는 자리다.
        <div className="flex flex-col items-start gap-4 rounded-xl border border-concrete-deep bg-paint/60 p-8">
          {/*
            "기록이 없습니다"는 사람이 없는 게임처럼 읽힌다. 같은 사실이라도
            비어 있는 1등 자리로 말하면 들어갈 이유가 된다.
          */}
          <p className="text-xl font-semibold">
            {course.name} · {MODE_LABELS[mode]} 1등 자리가 비어 있습니다
          </p>
          <p className="text-dim">
            {PERIOD_LABELS[period]} 기준으로 아직 아무도 기록을 남기지 않았습니다.
          </p>
          <Link
            href={`/play/${mode}/${course.id}`}
            className="rounded-lg bg-sign px-5 py-3 font-medium text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            1등으로 이름 올리기
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-md border-collapse text-left">
            <thead>
              <tr className="border-b border-concrete-deep font-mono text-sm tracking-[0.12em] text-dim uppercase">
                <th scope="col" className="py-3 pr-4 font-normal">순위</th>
                <th scope="col" className="py-3 pr-4 font-normal">이름</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">타/분</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">정확도</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">완주</th>
                <th scope="col" className="py-3 text-right font-normal">기록</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.id} className="border-b border-concrete-deep/60">
                  <td className="py-3 pr-4 font-mono tabular-nums text-dim">
                    {i + 1}
                  </td>
                  <td className="py-3 pr-4 font-medium">{entry.nickname}</td>
                  <td className="py-3 pr-4 text-right font-mono text-lg tabular-nums">
                    {Math.round(entry.cpm)}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-dim">
                    {(entry.accuracy * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-dim">
                    {entry.completed}/{entry.total}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-dim">
                    {formatClock(entry.elapsedMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

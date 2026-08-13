import Link from "next/link";
import { BackLink } from "@/components/BackLink";
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
import { RANKED_MODES, isRankedMode } from "@/lib/game/modes";
import { isModeId } from "@/lib/game/modes";
import type { ModeId } from "@/lib/game/types";

/** 순위는 항상 지금 상태를 보여줘야 하므로 캐시하지 않는다. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "랭킹 — 시군 타이핑",
  description: "코스별 기록 순위. 서버에서 검증한 기록만 오릅니다.",
};

/** 겨루는 판은 본편 하나다. lib/game/modes.ts의 RANKED_MODES가 그 목록이다. */
const BOARD_MODE = RANKED_MODES[0];

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
  /*
   * 겨루는 판이 하나뿐이라 고를 것이 없다. 주소에 다른 모드가 실려 와도
   * (없어진 타임어택 링크 같은 것) 본편 순위표를 보여 준다.
   */
  const mode: ModeId =
    isModeId(rawMode) && isRankedMode(rawMode) ? rawMode : BOARD_MODE;
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
      {/*
        검증 이야기는 여기 있지 않다.

        `서버에서 다시 계산해 검증한 기록만 올라갑니다`는 정확한 문장이고 이 표를
        믿을 근거이기도 하다. 다만 순위표를 열자마자 읽어야 하는 말은 아니다 —
        들어온 사람이 찾는 것은 1위와 내 자리이고, 그 앞에 두 줄이 서 있으면
        표가 두 줄만큼 아래로 밀린다. 의심이 든 사람만 찾아 읽으면 되는
        종류라, 표 아래로 내렸다.
      */}
      <header className="flex flex-col gap-3">
        <BackLink href="/">시군 타이핑</BackLink>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">랭킹</h1>
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
                  ? "bg-sign text-on-sign"
                  : "border border-concrete-deep text-ink hover:bg-concrete-deep"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        {/*
          모드 탭이 있었다. 겨루는 판이 하나뿐이 되면서 뺐다 — 고를 것이 하나면
          그건 선택지가 아니라 라벨이고, 라벨은 아래 표 제목이 이미 달고 있다.
        */}
        <div className="flex flex-wrap gap-2">
          {RANKING_PERIODS.map((p) => (
            <Link
              key={p}
              href={href({ period: p })}
              aria-current={p === period ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                p === period
                  ? "bg-ink text-on-sign"
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
            세 줄이 한 가지를 말하고 있었다 — 1등 자리가 비었다, 아무도 기록을
            남기지 않았다, 1등으로 이름을 올려라. 어느 코스의 어느 기간인지는
            바로 위 칩 두 줄이 이미 켜져 있으므로 여기서 되풀이할 것도 아니다.

            비어 있다는 사실 한 줄과 버튼 하나면 된다. `기록이 없습니다`가
            사람 없는 게임처럼 읽힌다는 것이 예전에 말을 늘린 이유였는데,
            그건 문장을 늘려 가릴 일이 아니라 버튼이 답할 일이다.
          */}
          <p className="text-xl font-semibold">아직 기록이 없습니다</p>
          <Link
            href={`/play/${mode}/${course.id}`}
            className="rounded-lg bg-sign px-5 py-3 font-medium text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            첫 기록 남기기
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-md border-collapse text-left">
            <thead>
              <tr className="border-b border-concrete-deep font-mono text-sm tracking-[0.12em] text-dim uppercase">
                <th scope="col" className="py-3 pr-4 font-normal">순위</th>
                <th scope="col" className="py-3 pr-4 font-normal">이름</th>
                {/*
                  순위는 완주 수와 시간으로 매겨진다. 그래서 그 둘이 앞에 온다.
                  타수를 빼는 이유: 맞힌 타수가 완주한 지역들의 이름 길이 합으로
                  고정되므로, 다 돈 판끼리는 타수 순위가 곧 시간 순위다.
                  같은 말을 두 번 적을 이유가 없다.
                */}
                <th scope="col" className="py-3 pr-4 text-right font-normal">완주</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">기록</th>
                <th scope="col" className="py-3 text-right font-normal">정확도</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.id} className="border-b border-concrete-deep/60">
                  <td className="py-3 pr-4 font-mono tabular-nums text-dim">
                    {i + 1}
                  </td>
                  <td className="py-3 pr-4 font-medium">{entry.nickname}</td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                    {entry.completed}/{entry.total}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-lg tabular-nums">
                    {formatClock(entry.elapsedMs)}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-dim">
                    {(entry.accuracy * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
        표 아래로 내린 검증 안내.

        표를 본 뒤에 드는 의문("이 기록을 믿어도 되나")에 답하는 자리라 표
        다음이 맞다. 접어 두지 않고 그냥 작게 둔다 — 두 줄짜리를 여닫게 만들면
        누르는 수고가 읽는 수고보다 커진다.
      */}
      <p className="mt-auto border-t border-concrete-deep pt-6 font-mono text-xs text-dim">
        서버에서 다시 계산해 검증한 기록만 올라갑니다. 채점 규칙이 같은
        기록끼리만 비교합니다.
      </p>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { beginGame } from "@/lib/analytics/track";
import type { CourseGeo } from "@/data/geo/types";
import type { Course } from "@/data/types";
import { MODES } from "@/lib/game/modes";
import { useGame } from "@/lib/game/useGame";
import { useImmersive } from "@/lib/useImmersive";
import type { RaceStart, RoomState } from "@/lib/multiplayer/types";
import { KeyHint } from "./Keycap";
import { Odometer } from "./Odometer";
import { RegionMap } from "./RegionMap";
import { CountdownPlate, useSecondsUntil } from "./CountdownPlate";
import { SignPlate } from "./SignPlate";
import { Standings } from "./Standings";
import { SubmitScore } from "./SubmitScore";
import { TypingSurface } from "./TypingSurface";

interface MultiRaceProps {
  course: Course;
  /** 대기실에서 미리 받아 둔 지도. 여기서는 문제 그 자체다. */
  geo: CourseGeo | null;
  room: RoomState;
  raceStart: RaceStart | null;
  selfId: string | null;
  onProgress: (u: { index: number; cpm: number; accuracy: number }) => void;
  onFinish: () => void;
  onGiveUp: () => void;
}

/**
 * 경주 화면. 싱글과 같은 엔진·같은 표지판을 쓰고, 옆에 남들 진행도가 붙는다.
 *
 * 출발 시점은 서버가 status를 racing으로 바꾸는 순간이다. startsAt과 클라이언트
 * 시계를 비교하지 않는 이유는 시계가 어긋나면 사람마다 다른 순간에 출발하기 때문이다.
 */
export function MultiRace({
  course,
  geo,
  room,
  raceStart,
  selfId,
  onProgress,
  onFinish,
  onGiveUp,
}: MultiRaceProps) {
  const items = useMemo(
    () =>
      course.regions.map((r) => ({
        id: r.code,
        answer: r.name,
        aliases: r.aliases,
      })),
    [course],
  );

  const { state, current, score, advancedAt, rejectedAt, begin, type, submitAnswer, hint } =
    useGame(items, MODES.multi, room.seed);

  /*
   * 이 화면이 떠 있는 동안 사이트의 헤더와 탭 바를 걷는다.
   *
   * /play와 달리 대결은 셸 안쪽 라우트에서 시작한다 — 방을 만드는 화면과
   * 경주하는 화면이 같은 주소다. 라우트 구조로는 가를 수 없어 여기서 표시한다.
   */
  useImmersive();

  /**
   * 세는 중.
   *
   * 이 화면은 세는 동안에도 떠 있다. 대기실에 머물다가 출발 신호에 경주 화면이
   * 붙는 구조였는데, 그러면 휴대폰에서 **출발과 동시에 자판이 없다** — 자판은
   * 사람이 화면을 눌러야 올라오고, 그동안 남들은 달린다. 판을 미리 깔아 두면
   * 세는 동안 한 번 누르는 것으로 준비가 끝난다.
   */
  const counting = room.status === "counting";
  const seconds = useSecondsUntil(room.startsAt);

  // 서버가 출발을 알린 그 순간에 시작한다.
  useEffect(() => {
    if (counting) return;
    beginGame();
    begin();
  }, [counting, begin]);

  // 한 지역을 통과할 때마다 내 위치를 알린다. 매 타건마다 보낼 이유는 없다.
  useEffect(() => {
    if (state.status !== "playing") return;
    onProgress({
      index: state.results.length,
      cpm: score.cpm,
      accuracy: score.accuracy,
    });
    // score는 매 프레임 바뀌므로 의존성에 넣지 않는다 — 통과 시점에만 보낸다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedAt, state.status]);

  const finishSent = useRef(false);
  useEffect(() => {
    if (state.status !== "finished" || finishSent.current) return;
    finishSent.current = true;
    onFinish();
  }, [state.status, onFinish]);

  // 막혔을 때 빠져나갈 길은 힌트뿐이다 — 건너뛰기는 순위가 진행 칸수로
  // 매겨지는 이상 열어 줄 수 없다.
  useEffect(() => {
    if (state.status !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // IME가 조합을 끝내려고 누른 엔터는 제출이 아니다.
        if (e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        submitAnswer();
        return;
      }
      if (e.key !== "Tab") return;
      // Tab이 포커스를 옮기면 입력창을 벗어나 경주 중에 타건이 먹지 않는다.
      e.preventDefault();
      hint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, hint, submitAnswer]);

  const passedCodes = useMemo(
    () => state.results.filter((r) => !r.skipped).map((r) => r.id),
    [state.results],
  );

  const done = state.status === "finished";
  const myRank = room.players.find((p) => p.id === selfId)?.rank ?? null;

  return (
    <div className="flex w-full flex-col gap-8">
      {done ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-concrete-deep bg-paint/60 p-8 text-center">
          <p className="font-mono text-xs tracking-[0.25em] text-dim uppercase">
            완주
          </p>
          <p className="text-4xl font-bold">
            {myRank ? `${myRank}위` : "완주"}
            <span className="ml-3 text-base font-medium text-dim">
              {Math.round(score.cpm)}타/분
            </span>
          </p>
          <p className="text-sm text-dim">
            정확도 {(score.accuracy * 100).toFixed(1)}% · 오타 {score.totalErrors}회
          </p>
          <SubmitScore
            token={raceStart?.token ?? null}
            courseId={room.courseId}
            mode={room.mode}
            seed={room.seed}
            state={state}
            score={score}
          />
        </div>
      ) : (
        current && (
          <>
            {/*
              멀티도 본편과 같은 문제를 푼다. 지도가 어디인지 묻고, 이름을 친다.
              이름을 띄워 주면 경주가 순수 타자 속도 시합이 되고, 그 순간
              시군을 소재로 쓸 이유가 사라진다.
            */}
            {geo && (
              <RegionMap
                geo={geo}
                // 세는 동안에는 아무 곳도 켜지 않는다. 미리 보여 주면 출발
                // 신호가 오기 전에 생각할 시간을 공짜로 갖는 셈이다.
                currentCode={counting ? undefined : current.id}
                passedCodes={passedCodes}
                variant="hint"
                className="h-[24vh] max-h-80 min-h-32 w-auto sm:h-[32vh]"
              />
            )}

            <TypingSurface
              onType={type}
              value={state.input}
              // 세는 동안 눌린 글자는 이 경주의 것이 아니다. 출발선에서 비운다.
              resetAt={counting ? 0 : 1}
            >
              <div className="mx-auto flex w-full max-w-xl items-baseline justify-between pb-2 font-mono text-base text-dim">
                <span className="tabular-nums">
                  {state.index + 1} / {state.items.length}
                </span>
              </div>
              {counting ? (
                <CountdownPlate seconds={seconds} />
              ) : (
              <SignPlate
                target={current.answer}
                typed={state.input}
                focused
                masked
                hinted={state.hintShown}
                judge={MODES.multi.judge}
                erroredAt={rejectedAt}
                rejected={
                  state.input !== "" &&
                  state.itemWrong[state.itemWrong.length - 1] === state.input
                }
                advancedAt={advancedAt}
                onSubmit={submitAnswer}
              />
              )}
            </TypingSurface>

            <p className="flex min-h-6 items-center justify-center text-sm text-dim">
              <KeyHint keys="Space">제출</KeyHint>
              {!state.hintShown && (
                // 추가 시간을 물리지 않는다. 경주에서는 힌트를 여는 동안
                // 상대가 달리는 것이 이미 값이다.
                <KeyHint keys="Tab">초성 힌트</KeyHint>
              )}
            </p>

            {/*
              판에서 내려오는 길.

              건너뛰기는 안 연다 — 순위가 진행 칸수로 매겨지므로 넘길 수 있으면
              다 넘긴 사람이 1등이 된다. 그런데 **방이 끝나려면 모두가 끝나야
              해서**, 한 사람이 영영 막히면 먼저 끝낸 사람들도 갇힌다. 건너뛰기를
              안 여는 것과 내려올 길이 없는 것은 다른 문제다.

              작게 둔다. 눈에 띄는 자리에 있으면 막히기 전에 누르게 된다.
            */}
            <button
              type="button"
              onClick={onGiveUp}
              className="mx-auto text-sm text-dim underline decoration-concrete-deep underline-offset-4 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              여기까지 하기
            </button>

            <Odometer
              cpm={score.cpm}
              accuracy={score.accuracy}
              elapsedMs={score.elapsedMs}
              remainingMs={Infinity}
            />
          </>
        )
      )}

      <Standings
        players={room.players}
        total={room.total}
        selfId={selfId}
        hostId={room.hostId}
      />
    </div>
  );
}

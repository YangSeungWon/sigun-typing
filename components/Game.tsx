"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CourseGeo } from "@/data/geo/types";
import type { Course } from "@/data/types";
import { MODES, MODE_LABELS } from "@/lib/game/modes";
import type { ModeId } from "@/lib/game/types";
import { useGame } from "@/lib/game/useGame";
import { requestToken } from "@/lib/score/client";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { beginGame, entrySource, readChallenge, track } from "@/lib/analytics/track";
import { NextChallenge } from "./NextChallenge";
import { RunLifecycle } from "./RunLifecycle";
import { RunRecorder } from "./RunRecorder";
import { Odometer } from "./Odometer";
import { KeyHint } from "./Keycap";
import { RegionMap } from "./RegionMap";
import { PersonalBestPanel } from "./PersonalBestPanel";
import { ShareResult } from "./ShareResult";
import { ResultCard } from "./ResultCard";
import { SubmitScore } from "./SubmitScore";
import { SignPlate } from "./SignPlate";
import { TypingSurface } from "./TypingSurface";

interface GameProps {
  course: Course;
  mode: ModeId;
  /** 코스 지도. 아직 지도가 없는 코스면 null. */
  geo?: CourseGeo | null;
  seed?: number;
  /**
   * 연습 판. 랭킹에도 개인 최고 기록에도 남기지 않는다.
   * 오답만 골라 푸는 판은 코스 전체와 비교할 수 없기 때문이다.
   */
  practice?: boolean;
}

/** 도전장의 목표 시간. 결과 화면과 같은 표기여야 같은 값으로 읽힌다. */
function formatChallengeTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;
}

export function Game({ course, mode, geo, seed = 1, practice = false }: GameProps) {
  const config = MODES[mode];
  const items = useMemo(
    () =>
      course.regions.map((r) => ({
        id: r.code,
        answer: r.name,
        aliases: r.aliases,
      })),
    [course],
  );

  const {
    state,
    current,
    remaining,
    score,
    advancedAt,
    erroredAt,
    streak,
    begin,
    type,
    giveUpItem,
    skipReveal,
    hint,
    restart,
  } = useGame(items, config, seed);
  const [focused, setFocused] = useState(false);
  const onFocusChange = useCallback((v: boolean) => setFocused(v), []);

  // 출발과 동시에 서명된 시작 토큰을 받아 둔다. 실패해도 게임은 그대로 진행되고
  // 랭킹 등록만 막힌다 — 서버가 죽었다고 못 놀 이유는 없다.
  const [token, setToken] = useState<string | null>(null);

  /**
   * 카운트다운은 연출이 아니라 기능이다. 출발을 누른 손이 홈 포지션으로 돌아갈
   * 시간을 주지 않으면 첫 지역에서만 타수가 유독 낮게 찍힌다. 토큰도 이 사이에 받는다.
   */
  const [countdown, setCountdown] = useState<number | null>(null);

  /**
   * 남이 보낸 도전장.
   *
   * 주소에 실려 온 값이라 믿을 수 없지만 믿을 필요도 없다 — 화면에 띄우는
   * 목표 문구일 뿐 순위에는 아무 영향도 주지 않는다. 고쳐 봐야 자기 화면의
   * 목표 시간만 바뀐다.
   */
  const hydrated = useIsHydrated();
  const [challenge] = useState(() => readChallenge());

  const startRun = useCallback(() => {
    setCountdown(3);
    // 이 판의 모든 이벤트가 하나의 gameId로 묶인다.
    // 오답 연습(practice)은 개인화된 문제 집합이라 퍼널에서 제외한다.
    beginGame(practice);
    track({
      name: "game_start",
      courseId: course.id,
      mode,
      total: course.regions.length,
      source: entrySource(),
    });
    // 연습 판은 랭킹에 올리지 않으므로 토큰을 받을 이유가 없다.
    if (!practice) requestToken(course.id, mode, seed).then(setToken);
  }, [course.id, course.regions.length, mode, seed, practice]);

  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        begin();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, begin]);

  /**
   * 첫 정답까지 갔는지가 이 게임에서 가장 중요한 지표다.
   * 여기서 크게 빠지면 콘텐츠가 아니라 첫 문제의 회상 부담이 문제다.
   */
  const firstCorrect = state.results.length > 0 && !state.results[0].skipped;
  useEffect(() => {
    if (!firstCorrect) return;
    track({
      name: "first_correct",
      courseId: course.id,
      mode,
      elapsedMs: state.results[0].elapsedMs,
      hintCount: state.results[0].hinted ? 1 : 0,
    });
    // 첫 정답은 판당 한 번이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstCorrect]);

  /**
   * 힌트를 본 항목이 끝날 때마다 힌트→정답 시간을 남긴다.
   *
   * 힌트를 여는 순간(hint_used)만으로는 그 힌트가 통했는지 알 수 없다.
   * 이벤트 수는 힌트를 쓴 횟수만큼이라, 안 쓰는 사람에게는 하나도 안 붙는다.
   */
  const reportedHints = useRef(0);
  useEffect(() => {
    for (let i = reportedHints.current; i < state.results.length; i++) {
      const r = state.results[i];
      reportedHints.current = i + 1;
      if (r.hintToAnswerMs === undefined) continue;
      track({
        name: "hint_resolved",
        courseId: course.id,
        mode,
        progress: i,
        total: state.items.length,
        elapsedMs: r.hintToAnswerMs,
      });
    }
  }, [state.results, state.items.length, course.id, mode]);

  /**
   * 지나온 지역 목록. 정체성을 유지해야 지도가 타건마다 다시 그려지지 않는다.
   */
  const passedCodes = useMemo(
    () => state.results.filter((r) => !r.skipped).map((r) => r.id),
    [state.results],
  );
  /** 포기했거나 틀린 채로 지나온 곳. 지도에서 회색과 구분해 칠한다. */
  const missedCodes = useMemo(
    () => state.results.filter((r) => r.skipped).map((r) => r.id),
    [state.results],
  );
  /** 결과 화면의 "다시 볼 곳". 오타만 낸 곳도 포함한다 — 헷갈렸다는 뜻이다. */
  const missedItems = useMemo(
    () => state.results.filter((r) => r.skipped || r.errors > 0),
    [state.results],
  );

  /**
   * 힌트를 연다. 키보드(Tab)와 모바일 버튼이 같은 길을 타야
   * 계측이 한쪽에서만 빠지는 일이 없다.
   */
  const onHintPressed = useCallback(() => {
    if (!state.hintShown) {
      track({
        name: "hint_used",
        courseId: course.id,
        mode,
        progress: state.results.length,
        total: state.items.length,
      });
    }
    hint();
  }, [state.hintShown, state.results.length, state.items.length, course.id, mode, hint]);

  const restartRun = useCallback(() => {
    setToken(null);
    setCountdown(null);
    reportedHints.current = 0;
    restart();
  }, [restart]);

  /**
   * 포기해서 정답을 보여 주는 중인 항목.
   *
   * 이 순간 index는 이미 다음 문제를 가리키므로, 화면에 그릴 것은 직전 결과다.
   */
  const revealing =
    state.status === "revealing" && state.revealed
      ? { id: state.results[state.results.length - 1]?.id, answer: state.revealed.answer }
      : null;

  // 출발 전에는 아무 키나 누르면 시작한다. 시작 버튼을 찾게 만들 이유가 없다.
  useEffect(() => {
    if (state.status !== "ready" || countdown !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      startRun();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, countdown, startRun]);

  /**
   * 정답을 보여 주는 중에는 Esc·Enter로 바로 넘어갈 수 있다.
   * 연달아 모르는 곳이 나올 때 매번 1.5초씩 기다리게 하지 않기 위해서다.
   */
  useEffect(() => {
    if (state.status !== "revealing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter") return;
      e.preventDefault();
      skipReveal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, skipReveal]);

  // 모르겠어요는 Esc. 허용된 모드에서만 동작한다.
  useEffect(() => {
    if (state.status !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && config.allowSkip) {
        e.preventDefault();
        giveUpItem();
      }
      // Tab은 원래 포커스를 옮기므로 막아야 한다. 입력창을 벗어나면 게임이 멈춘다.
      if (e.key === "Tab" && config.allowHint) {
        e.preventDefault();
        // progress를 함께 남긴다. 0이 많으면 사람들은 지도를 보는 대신
        // 힌트를 열어 이름을 읽는 방식으로 게임을 우회하는 중이다.
        onHintPressed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, config.allowSkip, config.allowHint, giveUpItem, onHintPressed]);

  if (state.status === "finished") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        {/* 붙었다는 것 자체가 판이 끝났다는 뜻이다. */}
        <RunRecorder courseId={course.id} results={state.results} />
        <RunLifecycle
          courseId={course.id}
          mode={mode}
          total={state.items.length}
          progress={state.results.filter((r) => !r.skipped).length}
          finished
          elapsedMs={score.elapsedMs}
          hintsUsed={state.hintsUsed}
        />
        <ResultCard
          courseName={course.name}
          modeLabel={MODE_LABELS[mode]}
          score={score}
          // 시간 제한이 있는 모드는 모두가 같은 60초를 쓰므로 시간이 성적이 아니다.
          emphasis={config.timeLimitMs === undefined ? "time" : "count"}
          geo={geo}
          passedCodes={passedCodes}
          missed={missedItems}
          coursesHref={`/play/${mode}`}
          nextSlot={
            practice ? null : (
              <NextChallenge courseId={course.id} mode={mode} score={score} />
            )
          }
          bestSlot={
            practice ? null : (
              <PersonalBestPanel
                courseId={course.id}
                mode={mode}
                score={score}
                courseVersion={course.version}
              />
            )
          }
          onRestart={restartRun}
          shareSlot={
            practice ? null : (
              <ShareResult
                courseId={course.id}
                courseName={course.name}
                mode={mode}
                score={score}
              />
            )
          }
          submitSlot={
            practice ? (
              <p className="font-mono text-sm text-dim">
                오답 연습은 랭킹과 개인 기록에 남지 않습니다
              </p>
            ) : (
              <SubmitScore
              token={token}
              courseId={course.id}
              mode={mode}
              seed={seed}
                state={state}
                score={score}
              />
            )
          }
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-4">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between font-mono text-sm tracking-[0.12em] text-dim uppercase">
        <Link
          href={`/play/${mode}`}
          className="transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          ← 코스 선택
        </Link>
        <span className="text-ink">{course.name}</span>
      </header>

      {/*
        transitioning도 포함해야 한다. playing만 보면 문제를 하나 넘길 때마다
        이 컴포넌트가 떨어졌다 붙으면서 그때마다 이탈로 기록된다.
      */}
      {(state.status === "playing" ||
        state.status === "transitioning" ||
        // revealing도 넣어야 한다. 빼면 포기할 때마다 이 컴포넌트가 떨어졌다
        // 붙으면서 그때마다 이탈로 기록된다.
        state.status === "revealing") && (
        <RunLifecycle
          courseId={course.id}
          mode={mode}
          total={state.items.length}
          progress={state.results.filter((r) => !r.skipped).length}
          finished={false}
          elapsedMs={score.elapsedMs}
          hintsUsed={state.hintsUsed}
        />
      )}

      <div /*
          모바일에서는 위로 붙인다. 가운데 정렬하면 위쪽 여백을 쓰느라
          입력판이 아래로 내려가는데, 키보드가 뜨면 그 자리가 가려진다.
        */
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-start gap-3 pt-2 sm:gap-4 sm:pt-6">
        {countdown !== null ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <span
              // key로 매 초 요소를 다시 붙여 숫자마다 애니메이션이 새로 돈다.
              key={countdown}
              className="count-in font-mono text-8xl font-semibold tabular-nums text-sign sm:text-9xl"
              aria-hidden="true"
            >
              {countdown}
            </span>
            <p className="font-mono text-base text-dim" role="status" aria-live="assertive">
              {countdown}초 뒤 출발 — 손을 자판에 올려 두세요
            </p>
          </div>
        ) : state.status === "ready" ? (
          <div className="flex flex-col items-center gap-6 text-center">
            {/*
              도전장을 받고 온 사람에게 코스 소개부터 읽히면 안 된다.
              무엇을 깨러 왔는지가 먼저다.
            */}
            {/*
              하이드레이션이 끝난 뒤에 그린다. 주소는 서버에 없으므로 첫
              렌더에서 읽으면 서버 HTML과 어긋나 화면이 통째로 다시 그려진다.
            */}
            {hydrated && challenge && (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-sign bg-sign/10 px-6 py-4">
                <span className="font-mono text-sm tracking-[0.18em] text-sign uppercase">
                  도전
                </span>
                <span className="text-2xl font-bold">
                  {challenge.by ? `${challenge.by}님의 ` : ""}
                  <span className="font-mono tabular-nums">
                    {formatChallengeTime(challenge.beatMs)}
                  </span>
                </span>
                <span className="text-base text-dim">이 기록을 깨 보세요</span>
              </div>
            )}
            <h1 className="text-4xl font-bold sm:text-5xl">{course.name}</h1>
            <p className="max-w-sm text-dim">{course.description}</p>
            <button
              type="button"
              onClick={startRun}
              className="rounded-lg bg-sign px-8 py-4 text-lg font-medium text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              출발
            </button>
            <p className="font-mono text-sm text-dim">아무 키나 눌러도 출발합니다</p>
          </div>
        ) : (
          current && (
            <>
              {/*
                지도가 이 게임의 주인공이다. 퀴즈에서는 문제 그 자체이고,
                이름을 보여 주는 모드에서도 맞힐 때마다 칠해지는 진행 시각화다.
                지도 없이 이름만 따라 치면 그냥 타자연습이 된다.
              */}
              {geo && (
                <RegionMap
                  geo={geo}
                  currentCode={revealing ? revealing.id : current.id}
                  passedCodes={passedCodes}
                  missedCodes={missedCodes}
                  variant={config.reveal ? "route" : "hint"}
                  // 화면 높이에 비례시킨다. 고정 높이로 두면 노트북에서 계기판이
                  // 접혀 주행 중에 스크롤해야 한다.
                  className="h-[26vh] max-h-96 min-h-36 w-auto sm:h-[38vh]"
                />
              )}

              {/*
                진행 표시는 입력판에 바로 붙인다. 지도와 판 사이에 띄워 두면
                지도 진행률인지 입력 진행률인지 소속을 알 수 없다.
              */}
              <TypingSurface
                onType={type}
                advancedAt={advancedAt}
                onFocusChange={onFocusChange}
              >
                <div className="mx-auto flex w-full max-w-xl items-baseline justify-between pb-2 font-mono text-base text-dim">
                  <span className="tabular-nums">
                    {state.index + 1} / {state.items.length}
                  </span>
                  {streak >= 3 && <span className="text-sign">무오타 ×{streak}</span>}
                </div>
                <SignPlate
                  target={revealing ? revealing.answer : current.answer}
                  typed={revealing ? "" : state.input}
                  focused={focused}
                  masked={!config.reveal}
                  revealed={Boolean(revealing)}
                  hinted={state.hintShown}
                  erroredAt={erroredAt}
                  advancedAt={advancedAt}
                />
              </TypingSurface>

              {/*
                모바일에는 Tab도 Esc도 없다. 키 안내만 두면 손가락으로 노는
                사람은 힌트도 포기도 쓸 수 없어, 한 곳을 모르는 순간 막다른
                길에 갇힌다. 좁은 화면에서는 같은 기능을 버튼으로 낸다.

                onMouseDown에서 preventDefault를 하는 이유: 버튼을 누르면
                입력창이 포커스를 잃고, 그러면 그 뒤로 아무리 쳐도 반응이 없다.
              */}
              <div className="flex min-h-11 items-center justify-center gap-3 sm:hidden">
                {config.allowHint && !state.hintShown && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onHintPressed}
                    className="rounded-lg border border-concrete-deep bg-paint px-4 py-2.5 text-base text-ink active:bg-concrete-deep"
                  >
                    초성 힌트
                    <span className="ml-1.5 font-mono text-sm text-dim">
                      +{(config.hintPenaltyMs ?? 0) / 1000}초
                    </span>
                  </button>
                )}
                {config.allowSkip && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (revealing ? skipReveal() : giveUpItem())}
                    className="rounded-lg border border-concrete-deep bg-paint px-4 py-2.5 text-base text-ink active:bg-concrete-deep"
                  >
                    {revealing ? "다음" : "모르겠어요"}
                  </button>
                )}
              </div>

              {/* 포커스를 잃으면 아무리 쳐도 반응이 없다. 그 사실을 알려 준다. */}
              <p
                className="hidden min-h-6 flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-dim sm:flex"
                role="status"
                aria-live="polite"
              >
                {!focused ? (
                  "표지판을 눌러 계속 입력하세요"
                ) : (
                  <>
                    {config.allowHint && !state.hintShown && (
                      <KeyHint keys="Tab">
                        초성 힌트 · +{(config.hintPenaltyMs ?? 0) / 1000}초
                      </KeyHint>
                    )}
                    {config.allowSkip && <KeyHint keys="Esc">모르겠어요</KeyHint>}
                  </>
                )}
              </p>

              <Odometer
                cpm={score.cpm}
                accuracy={score.accuracy}
                elapsedMs={score.elapsedMs}
                remainingMs={remaining}
              />
            </>
          )
        )}
      </div>
    </main>
  );
}

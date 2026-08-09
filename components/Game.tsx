"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CourseGeo } from "@/data/geo/types";
import type { Course } from "@/data/types";
import { MODES, MODE_LABELS } from "@/lib/game/modes";
import type { ModeId } from "@/lib/game/types";
import { useGame } from "@/lib/game/useGame";
import { focusScale } from "@/lib/geo/bbox";
import { playComplete, playCorrect, primeSound } from "@/lib/sound";
import { romanizeRegion } from "@/lib/hangul/romanize";
import { requestToken } from "@/lib/score/client";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { beginGame, entrySource, readChallenge, track } from "@/lib/analytics/track";
import { NextChallenge } from "./NextChallenge";
import { RunLifecycle } from "./RunLifecycle";
import { RunRecorder } from "./RunRecorder";
import { formatClock, Odometer } from "./Odometer";
import { KeyHint } from "./Keycap";
import { CourseComplete } from "./CourseComplete";
import { MiniMap } from "./MiniMap";
import { SoundToggle } from "./SoundToggle";
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

/**
 * 초성을 본 뒤 같은 키로 정답까지 가려면 이만큼은 지나야 한다.
 * 초성을 읽을 시간도 없이 정답이 떠 버리면 힌트가 있으나 마나다.
 */
const HINT_TO_GIVE_UP_GRACE_MS = 600;

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
  /** 완성 화면을 이미 보여 줬는지. 한 판에 한 번이다. */
  const [celebrated, setCelebrated] = useState(false);

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
    primeSound();
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

  /*
   * 한 곳 통과할 때마다 짧게. advancedAt은 항목이 확정될 때만 바뀌므로
   * 오답이나 조합 중에는 울리지 않는다.
   */
  useEffect(() => {
    if (advancedAt > 0) playCorrect();
  }, [advancedAt]);

  useEffect(() => {
    if (state.status === "finished" && score.completed === score.total) {
      playComplete();
    }
    // 판이 끝나는 순간 한 번만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

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

  useEffect(() => {
    if (state.status !== "finished" || score.completed !== score.total) return;
    // 1.6초. 지도를 훑어보기에는 충분하고, 기록을 보려는 사람을 붙잡아
    // 두기에는 짧다. 아무 키나 누르면 바로 넘어간다.
    const timer = setTimeout(() => setCelebrated(true), 1_600);
    const skip = () => setCelebrated(true);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
    // 판이 끝나는 순간 한 번만 건다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const restartRun = useCallback(() => {
    setToken(null);
    setCountdown(null);
    setCelebrated(false);
    reportedHints.current = 0;
    restart();
  }, [restart]);

  /**
   * 포기해서 정답을 보여 주는 중인 항목.
   *
   * 이 순간 index는 이미 다음 문제를 가리키므로, 화면에 그릴 것은 직전 결과다.
   */
  /**
   * 미니맵은 충분히 당겼을 때만 띄운다.
   *
   * 서울 25구처럼 코스 지도가 곧 그 도시인 경우, 조금 당긴 화면에는 이미
   * 전체가 거의 들어와 있다. 거기에 미니맵을 띄우면 같은 그림을 작게 한 번
   * 더 그리는 꼴이라 도움이 아니라 소음이다.
   */
  const showMiniMap = useMemo(() => {
    if (!geo) return false;
    const code = state.items[state.index]?.id;
    return focusScale(geo.regions.find((r) => r.code === code), geo) >= 2.2;
  }, [geo, state.items, state.index]);

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
   * 정답을 보여 주는 동안에는 아무 키나 누르면 다음으로 간다.
   *
   * 시간이 지나면 알아서 넘기던 것을 그만뒀다. 읽는 속도는 사람마다 다르고,
   * 읽는 도중에 화면이 저절로 바뀌는 것이 불쾌하다. 출발할 때 아무 키나
   * 눌러도 되는 것과 같은 규칙이라 따로 배울 것도 없다.
   */
  useEffect(() => {
    if (state.status !== "revealing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
        /*
         * 같은 키로 단계가 올라간다. 초성 → 정답.
         * 막혔을 때 손가락을 옮기지 않아도 되고, 다음에 뭘 눌러야 하는지
         * 생각할 것도 없다.
         *
         * 두 가지를 막아야 한다. 키를 누르고 있으면 반복 입력이 들어와
         * 초성을 보기도 전에 정답이 뜨고(e.repeat), 확인하려고 두 번 두드리는
         * 사람도 마찬가지다(GRACE). 정답 공개는 되돌릴 수 없으므로
         * 실수로 도달하는 길을 열어 두면 안 된다.
         */
        if (!state.hintShown) {
          onHintPressed();
        } else if (
          config.allowSkip &&
          !e.repeat &&
          state.hintShownAt !== null &&
          Date.now() - state.hintShownAt > HINT_TO_GIVE_UP_GRACE_MS
        ) {
          giveUpItem();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    state.status,
    state.hintShown,
    state.hintShownAt,
    config.allowSkip,
    config.allowHint,
    giveUpItem,
    onHintPressed,
  ]);

  /*
   * 다 채운 순간을 잠깐 보여 준 뒤 결과로 넘어간다.
   *
   * 마지막 한 곳을 맞히자마자 숫자 표가 뜨면 이 게임에서 가장 중요한 순간이
   * 그냥 지나간다. 전부 맞힌 판에서만 뜬다 — 절반만 맞히고 끝난 판에
   * 축하가 뜨면 그건 축하가 아니라 조롱이다.
   */
  const perfect = state.status === "finished" && score.completed === score.total;
  if (perfect && !celebrated) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <CourseComplete
          courseName={course.name}
          total={score.total}
          placeUnit={course.placeUnit}
          elapsedMs={score.elapsedMs}
          geo={geo}
          passedCodes={passedCodes}
        />
      </main>
    );
  }

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
    <main className="flex flex-1 flex-col px-6 py-2 sm:py-4">
      {/*
        모바일에서는 플레이 중 헤더를 감춘다. 키보드가 화면의 절반을 가져가는
        상황에서 세로 한 줄은 지도 한 줄과 같은 값이다. 나가는 길은 결과
        화면과 브라우저 뒤로 가기가 있다.
      */}
      <header className="mx-auto hidden w-full max-w-3xl items-center justify-between font-mono text-sm tracking-[0.12em] text-dim uppercase sm:flex">
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
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-start gap-2 pt-1 sm:gap-4 sm:pt-6">
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
              {/*
                진행도·시간·미니맵을 한 줄에 모은다.
                미니맵을 지도 위에 얹었더니 정작 지도를 가렸다. 지도 밖으로
                내보내면 겹칠 일이 없고, 세로도 한 줄이면 된다.
              */}
              <div className="flex w-full items-center justify-between gap-3 font-mono text-sm tabular-nums text-dim">
                <span>
                  {state.index + (revealing ? 0 : 1)} / {state.items.length}
                </span>
                <div className="flex items-center gap-3">
                  {geo && showMiniMap && (
                    // 배경을 깔아 준다. 같은 회색 위에 얹으면 이 크기에서는
                    // 지도가 아니라 얼룩으로 보인다.
                    <span className="rounded-md border border-concrete-deep bg-paint/70 px-1.5 py-1">
                      <MiniMap
                        geo={geo}
                        currentCode={revealing ? revealing.id : current.id}
                        passedCodes={passedCodes}
                        className="h-11 w-auto sm:h-14"
                      />
                    </span>
                  )}
                  <span className="sm:hidden">
                    {Number.isFinite(remaining)
                      ? formatClock(remaining)
                      : formatClock(score.elapsedMs)}
                  </span>
                  <SoundToggle />
                  {streak >= 3 && <span className="text-sign">무오타 ×{streak}</span>}
                </div>
              </div>

              {geo && (
                <div className="relative w-full overflow-hidden rounded-xl border border-concrete-deep bg-paint/40">
                <RegionMap
                  geo={geo}
                  currentCode={revealing ? revealing.id : current.id}
                  passedCodes={passedCodes}
                  missedCodes={missedCodes}
                  focus
                  variant={config.reveal ? "route" : "hint"}
                  // 화면 높이에 비례시킨다. 고정 높이로 두면 노트북에서 계기판이
                  // 접혀 주행 중에 스크롤해야 한다.
                  className="mx-auto h-[29vh] max-h-96 min-h-36 w-auto sm:h-[38vh]"
                />
                </div>
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
                <SignPlate
                  target={revealing ? revealing.answer : current.answer}
                  typed={revealing ? "" : state.input}
                  focused={focused}
                  masked={!config.reveal}
                  revealed={Boolean(revealing)}
                  roman={romanizeRegion(
                    revealing ? revealing.answer : current.answer,
                    course.placeUnit,
                  )}
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
                {revealing ? (
                  "아무 키나 누르면 다음"
                ) : !focused ? (
                  "표지판을 눌러 계속 입력하세요"
                ) : (
                  <>
                    {config.allowHint && (
                      <KeyHint keys="Tab">
                        {state.hintShown
                          ? "한 번 더 누르면 정답"
                          : `초성 힌트 · +${(config.hintPenaltyMs ?? 0) / 1000}초`}
                      </KeyHint>
                    )}
                    {config.allowSkip && <KeyHint keys="Esc">모르겠어요</KeyHint>}
                  </>
                )}
              </p>

              {/*
                타수와 정확도는 플레이 중 판단에 쓰이지 않는다. 좁은 화면에서는
                그 자리를 지도에 준다.
              */}
              <div className="hidden w-full sm:block">
                <Odometer
                  cpm={score.cpm}
                  accuracy={score.accuracy}
                  elapsedMs={score.elapsedMs}
                  remainingMs={remaining}
                />
              </div>
            </>
          )
        )}
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CourseGeo } from "@/data/geo/types";
import type { Course } from "@/data/types";
import { MODES, MODE_LABELS } from "@/lib/game/modes";
import type { ModeId } from "@/lib/game/types";
import { useGame } from "@/lib/game/useGame";
import {
  playComplete,
  playCorrect,
  playGiveUp,
  playHint,
  playStart,
  playTick,
  playWrong,
  playUrgent,
  primeSound,
} from "@/lib/sound";
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
    now,
    remaining,
    score,
    advancedAt,
    erroredAt,
    rejectedAt,
    streak,
    begin,
    type,
    submitAnswer,
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

  /*
   * 화면에 들어오면 알아서 센다.
   *
   * 코스를 고르고 들어온 사람에게 "출발"을 한 번 더 누르라고 할 이유가 없다.
   * 대신 판을 미리 깔아 두고 셋을 센다 — 손을 자판에 올릴 시간은 필요하고,
   * 그 사이에 화면이 어떻게 생겼는지도 눈에 익는다.
   */
  useEffect(() => {
    if (state.status !== "ready" || countdown !== null) return;
    const timer = setTimeout(startRun, 350);
    return () => clearTimeout(timer);
    // 판이 준비되는 순간 한 번만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        playStart();
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
    // 포기해도 항목은 확정되므로 advancedAt이 움직인다. 그때는 울리지 않는다 —
    // 모르겠다고 넘긴 자리에서 맞힘 소리가 나면 신호가 거짓말을 하는 것이다.
    if (advancedAt > 0 && !state.results[state.results.length - 1]?.skipped) {
      playCorrect(streak);
    }
    // 소리는 항목이 확정될 때만. streak는 그 순간의 값을 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedAt]);

  /*
   * 아래 소리들은 버튼이 아니라 **상태**에 붙인다. 포기 하나만 해도 Esc,
   * Tab 두 번, 화면의 버튼, 모바일 버튼까지 길이 넷이라 각 자리에 소리를
   * 넣으면 언젠가 한 길이 빠진다.
   */
  useEffect(() => {
    if (state.hintShown) playHint();
  }, [state.hintShown]);

  useEffect(() => {
    if (rejectedAt > 0) playWrong();
  }, [rejectedAt]);

  const skippedCount = state.results.filter((r) => r.skipped).length;
  useEffect(() => {
    if (skippedCount > 0) playGiveUp();
  }, [skippedCount]);

  useEffect(() => {
    if (countdown !== null) playTick();
  }, [countdown]);

  /*
   * 타임어택 마지막 5초. 초마다 한 번이고 정답 소리보다 낮다 —
   * 시계를 보려고 눈을 떼지 않아도 시간이 어디쯤인지 알 수 있어야 한다.
   */
  const urgentSecond = useRef(0);
  useEffect(() => {
    if (state.status !== "playing" || !Number.isFinite(remaining)) return;
    const left = Math.ceil(remaining / 1000);
    if (left > 5 || left <= 0 || urgentSecond.current === left) return;
    urgentSecond.current = left;
    playUrgent();
  }, [remaining, state.status]);

  useEffect(() => {
    if (state.status === "finished" && score.completed === score.total) {
      playComplete();
    }
    // 판이 끝나는 순간 한 번만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  /*
   * 맞히면 바로 넘어간다. 붙잡아 두는 것이 없다.
   *
   * 한때 방금 맞힌 곳의 이름을 지도에 띄우고 카메라를 그 자리에 세워 뒀다.
   * 모양과 이름을 묶어 주려던 것인데, 사라지는 조건을 "다음 글자를 치면"으로
   * 두니 안 치고 있으면 화면이 계속 이전 문제에 머물렀고, 상한 4초는
   * 빠르게 치는 리듬과 정면으로 부딪혔다. 이 게임의 손맛은 **맞히는 순간
   * 곧바로 다음**이다. 확인은 소리와 지도에 칠해지는 색으로 충분하고,
   * 이름을 다시 봐야 하는 사람에게는 결과 화면의 "다시 볼 곳"이 있다.
   */

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
    urgentSecond.current = 0;
    restart();
  }, [restart]);

  /**
   * 포기해서 정답을 보여 주는 중인 항목.
   *
   * 이 순간 index는 이미 다음 문제를 가리키므로, 화면에 그릴 것은 직전 결과다.
   */
  /**
   * 미니맵은 항상 띄운다.
   *
   * 한때 배율을 보고 켜고 껐다 — 당기지 않는 코스에서는 같은 그림을 작게 한
   * 번 더 그리는 셈이니까. 그런데 그 판단을 문제마다 했더니 경기·서울처럼 큰
   * 지역과 작은 지역이 섞인 코스에서 미니맵이 나타났다 사라지기를 반복했고,
   * 그때마다 계기판 높이가 20px↔54px로 뛰어 지도까지 통째로 밀렸다.
   *
   * 코스 단위로 한 번만 정하는 것으로 흔들림은 잡히지만, 그러면 코스마다
   * 계기판이 다르게 생긴다. 미니맵은 "지금 여기"를 알려 주는 자리이고 그
   * 자리가 코스에 따라 있다 없다 하면 매번 다시 찾아야 한다. 전국 코스를
   * 붙이면 어차피 모든 코스가 당기는 쪽이 된다.
   */
  const showMiniMap = !!geo;

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

  /*
   * 엔터로 제출한다. 스페이스도 같은 일을 하지만 그쪽은 엔진이 값에 들어온
   * 공백을 보고 처리한다 — 한글 IME에서 스페이스는 조합을 끝내는 키이기도
   * 해서, 키를 가로채면 마지막 글자가 확정되기 전에 제출이 나간다.
   */
  useEffect(() => {
    if (state.status !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) return;
      // IME가 조합을 끝내려고 누른 엔터는 제출이 아니다. 이걸 빼면 조합 중인
      // 마지막 글자가 확정되는 순간 곧바로 오답으로 접수된다.
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      submitAnswer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, submitAnswer]);

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
          reviewSlot={
            practice || missedItems.length === 0 ? null : (
              <Link
                href={`/review/${course.id}`}
                onClick={() => track({ name: "mode_switch", courseId: course.id, mode, toMode: "review" })}
                className="rounded-lg bg-sign px-5 py-4 text-center text-lg font-medium text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                틀린 {missedItems.length}곳 다시 하기
              </Link>
            )
          }
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
        플레이 중 화면 위쪽 정보는 한 줄뿐이다.
        나가는 길·코스·진행·시간·미니맵이 좌상단과 우상단에 흩어져 있으면
        시선이 갈린다. 한 줄로 묶으면 그 아래 지도가 무대 전체를 쓴다.
      */}
      <header className="mx-auto flex w-full max-w-3xl items-center gap-3 font-mono text-sm tabular-nums text-dim">
        <Link
          href={`/play/${mode}`}
          aria-label="코스 선택으로"
          className="transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span aria-hidden="true">←</span>
          <span className="ml-2 hidden tracking-[0.12em] uppercase sm:inline">
            코스 선택
          </span>
        </Link>

        {/* 시작 화면에는 같은 이름이 큰 글씨로 있다. 두 번 쓸 이유가 없다. */}
        <span className="hidden truncate text-ink sm:inline">
          {state.status === "ready" ? "" : course.name}
        </span>

        <span className="ml-auto flex items-center gap-3">
          {/*
            세는 동안에도 같은 줄을 채운다. 시작하면서 미니맵이 붙으면 그
            높이만큼 아래가 통째로 밀린다 — 하필 첫 문제가 뜨는 순간이다.
          */}
          {(state.status !== "ready" || countdown !== null) && (
            <>
              <span>
                {state.index + (revealing ? 0 : 1)} / {state.items.length}
              </span>
              <span>
                {Number.isFinite(remaining)
                  ? formatClock(remaining)
                  : formatClock(score.elapsedMs)}
              </span>
              {streak >= 3 && <span className="text-sign">무오타 ×{streak}</span>}
              {geo && showMiniMap && (
                // 배경을 깔아 준다. 같은 회색 위에 얹으면 이 크기에서는
                // 지도가 아니라 얼룩으로 보인다.
                <span className="rounded-md border border-concrete-deep bg-paint/70 px-1.5 py-1">
                  <MiniMap
                    geo={geo}
                    // 세는 동안에는 표시점을 찍지 않는다. 미리 보여 주면
                    // 시계가 돌기 전에 생각할 시간을 공짜로 준다.
                    currentCode={
                      countdown !== null ? undefined : revealing ? revealing.id : current?.id
                    }
                    passedCodes={passedCodes}
                    className="h-9 w-auto sm:h-11"
                  />
                </span>
              )}
            </>
          )}
          <SoundToggle />
        </span>
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
        className={`play-stage mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-2 pt-1 sm:gap-4 sm:pt-6 ${
          /*
           * 세는 동안에도 판은 같은 자리에 있어야 한다. 가운데 두었다가
           * 시작하면서 위로 붙이면, 첫 문제가 뜨는 순간 화면이 통째로 뛴다 —
           * 하필 지도를 보려는 그 순간이다.
           */
          // 세는 동안에도 status는 아직 ready다. 카운트다운이 돌면 이미 판이다.
          state.status === "ready" && countdown === null
            ? "justify-center"
            : "justify-start"
        }`}>
        {countdown !== null ? (
          <>
            {/*
              세는 동안에도 판은 그대로 있다. 빈 화면에 숫자만 튀는 것보다
              어디에 무엇이 나올지 눈에 익히는 편이 낫다.

              지도에는 아무 곳도 켜지 않는다. 미리 보여 주면 시계가 돌기 전에
              생각할 시간을 공짜로 주는 셈이라 기록이 흔들린다.
            */}
            {geo && (
              <div className="play-map relative w-full max-w-2xl overflow-hidden rounded-xl border border-concrete-deep bg-paint/40">
                <RegionMap
                  geo={geo}
                  variant="route"
                  className="mx-auto h-[31vh] max-h-[28rem] min-h-40 w-auto sm:h-[44vh]"
                />

                {/*
                  도전장을 받고 온 사람은 무엇을 깨러 왔는지 봐야 한다.
                  예전에는 출발 화면에 있었는데 그 화면이 없어졌다.

                  지도 위에 겹쳐 둔다 — 자리를 차지하면 시작하는 순간 그 높이만큼
                  아래가 밀리고, 하필 첫 문제가 뜨는 순간이다.
                */}
                {hydrated && challenge && (
                  <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                    <span className="flex items-baseline gap-2 rounded-lg border border-sign bg-paint/90 px-4 py-2">
                      <span className="font-mono text-xs tracking-[0.18em] text-sign uppercase">
                        도전
                      </span>
                      <span className="font-mono text-lg font-semibold tabular-nums">
                        {formatChallengeTime(challenge.beatMs)}
                      </span>
                      {challenge.by && (
                        <span className="text-sm text-dim">{challenge.by}</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="play-input flex w-full flex-col items-center gap-2 sm:gap-3">
              <div className="sign-face relative mx-auto flex w-full max-w-2xl items-center justify-center rounded-2xl px-4 py-6 shadow-[0_3px_0_0_var(--color-sign-deep)] sm:px-10 sm:py-8">
                <span className="pointer-events-none absolute inset-2 rounded-xl border-2 border-paint sm:inset-2.5" />
                <span
                  // key로 매 초 요소를 다시 붙여 숫자마다 애니메이션이 새로 돈다.
                  key={countdown}
                  className="count-in relative font-mono text-6xl font-bold tabular-nums text-paint sm:text-7xl"
                  aria-hidden="true"
                >
                  {countdown}
                </span>
              </div>
              <p className="font-mono text-xs text-dim/80" role="status" aria-live="assertive">
                {countdown}초 뒤 시작 — 손을 자판에 올려 두세요
              </p>
            </div>
          </>
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
            {/*
              코스 설명은 빼 둔다. 여기까지 온 사람은 이미 그 코스를 고른
              것이고, 지금 필요한 것은 시작하는 일뿐이다. 설명은 코스를
              고르는 화면과 코스 소개 페이지에 있다.
            */}
            <h1 className="text-4xl font-bold sm:text-5xl">{course.name}</h1>
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
                <div className="play-map relative w-full max-w-2xl overflow-hidden rounded-xl border border-concrete-deep bg-paint/40">
                <RegionMap
                  geo={geo}
                  currentCode={revealing ? revealing.id : current.id}
                  passedCodes={passedCodes}
                  missedCodes={missedCodes}
                  focus
                  variant={config.reveal ? "route" : "hint"}
                  // 화면 높이에 비례시킨다. 고정 높이로 두면 노트북에서 계기판이
                  // 접혀 주행 중에 스크롤해야 한다.
                  className="mx-auto h-[31vh] max-h-[28rem] min-h-40 w-auto sm:h-[44vh]"
                />
                </div>
              )}

              {/*
                진행 표시는 입력판에 바로 붙인다. 지도와 판 사이에 띄워 두면
                지도 진행률인지 입력 진행률인지 소속을 알 수 없다.
              */}
              {/* 가로로 누우면 이 덩어리가 지도 오른쪽으로 간다. */}
              <div className="play-input flex w-full flex-col items-center gap-2 sm:gap-3">
              <TypingSurface
                onType={type}
                advancedAt={advancedAt}
                rejectedAt={rejectedAt}
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
                  judge={config.judge}
                  /*
                   * 흔들리는 계기가 모드마다 다르다. 따라치기에서는 경로를
                   * 벗어난 순간이고, 회상 모드에서는 오답을 제출한 순간이다.
                   */
                  erroredAt={config.judge === "enter" ? rejectedAt : erroredAt}
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
                {/*
                  휴대폰 자판의 확인 키가 엔터로 오지 않는 경우가 있다 —
                  한글 조합을 끝내는 데 쓰이거나 자판만 닫히기도 한다.
                  제출이 유일한 통로인 모드에서 그 키가 안 먹으면 판이 막힌다.
                */}
                {!revealing && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitAnswer}
                    className="rounded-lg border border-concrete-deep bg-paint px-4 py-2.5 text-base text-ink active:bg-concrete-deep"
                  >
                    제출
                  </button>
                )}
                {config.allowHint && !state.hintShown && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onHintPressed}
                    className="rounded-lg border border-concrete-deep bg-paint px-4 py-2.5 text-base text-ink active:bg-concrete-deep"
                  >
                    힌트
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
                className="mt-2 hidden min-h-6 flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-dim/80 sm:flex"
                role="status"
                aria-live="polite"
              >
                {revealing ? (
                  "아무 키나 누르면 다음"
                ) : !focused ? (
                  "표지판을 눌러 계속 입력하세요"
                ) : (
                  <>
                    {/*
                      제출은 여기서 말하지 않는다. 판 오른쪽 화살표가 이미
                      그 자리에서 말하고 있고, 같은 말을 두 곳에서 하면
                      읽어야 할 것만 늘어난다.

                      "초성 힌트"도 "힌트"로 줄인다 — 눌러 보면 초성이
                      뜨므로 시스템 용어를 미리 가르칠 이유가 없다.
                    */}
                    {config.allowHint && (
                      <KeyHint keys="Tab">
                        {state.hintShown
                          ? "한 번 더 누르면 정답"
                          : `힌트 +${(config.hintPenaltyMs ?? 0) / 1000}초`}
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
              {/*
                플레이 중 판단에 쓰는 것은 지도와 입력판이다. 타수와 정확도는
                거기에 답하지 않으면서 매 타건마다 바뀌어 시선을 끌어간다 —
                특히 첫 문제를 풀기 전에는 `0타/분 · 0.0%`가 그냥 소음이다.
                결과 화면에 다 있으니 여기서는 시간만 남긴다.

                시간 제한이 있는 모드는 예외다. 거기서는 남은 시간이 곧 게임이고,
                타수도 성적의 일부다.
              */}
              {/*
                시간은 이미 위 한 줄에 있다. 제한 시간이 있는 모드에서만
                큰 숫자로 한 번 더 보여 준다 — 거기서는 남은 시간이 곧 게임이다.
              */}
              </div>

              {config.timeLimitMs !== undefined && (
                <div className="hidden w-full sm:block">
                  <Odometer
                    cpm={score.cpm}
                    accuracy={score.accuracy}
                    elapsedMs={score.elapsedMs}
                    remainingMs={remaining}
                  />
                </div>
              )}
            </>
          )
        )}
      </div>
    </main>
  );
}

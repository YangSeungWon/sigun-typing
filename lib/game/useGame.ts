"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGame,
  remainingMs,
  revealHint,
  score,
  setInput,
  submit,
  giveUp,
  settleReveal,
  start,
  tick,
} from "./engine";
import type { GameItem, GameState, ModeConfig } from "./types";

/**
 * 엔진을 React 상태로 감싼다. 게임 규칙은 전부 engine.ts에 있고
 * 여기서는 시각(now)을 흘려보내고 렌더를 트리거하는 일만 한다.
 */
export function useGame(items: GameItem[], config: ModeConfig, seed = 1) {
  const [state, setState] = useState<GameState>(() =>
    createGame(items, config, Date.now(), seed),
  );
  const [now, setNow] = useState(() => Date.now());

  /*
   * 재생 중에는 프레임마다 시각을 갱신한다.
   * transitioning도 함께 돌려야 한다 — tick이 전환을 풀어 주는 유일한 통로라,
   * 여기서 빼면 정답을 맞힌 뒤 판이 그대로 잠긴다.
   */
  useEffect(() => {
    if (
      state.status !== "playing" &&
      state.status !== "transitioning" &&
      // 정답을 보여 주는 시간을 풀어 주는 것도 tick이다. 빼면 판이 잠긴다.
      state.status !== "revealing"
    )
      return;
    let frame = 0;
    const loop = () => {
      const t = Date.now();
      setNow(t);
      setState((s) => tick(s, t));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.status]);

  /** 이번 입력으로 항목이 확정되었는지 — 입력창 초기화와 통과 연출의 신호. */
  const lastIndex = useRef(state.index);
  const [advancedAt, setAdvancedAt] = useState(0);
  useEffect(() => {
    if (state.index !== lastIndex.current) {
      lastIndex.current = state.index;
      setAdvancedAt((n) => n + 1);
    }
  }, [state.index]);

  /** 오답을 제출한 순간 — 흔들림과 소리의 신호. */
  const lastRejected = useRef(state.rejectedAt);
  const [rejectedAt, setRejectedAt] = useState(0);
  useEffect(() => {
    if (state.rejectedAt !== null && state.rejectedAt !== lastRejected.current) {
      setRejectedAt((n) => n + 1);
    }
    lastRejected.current = state.rejectedAt;
  }, [state.rejectedAt]);

  /** 정답 경로를 막 벗어난 순간 — 흔들림 연출의 신호. */
  const wasOffTrack = useRef(state.offTrack);
  const [erroredAt, setErroredAt] = useState(0);
  useEffect(() => {
    if (state.offTrack && !wasOffTrack.current) setErroredAt((n) => n + 1);
    wasOffTrack.current = state.offTrack;
  }, [state.offTrack]);

  /** 오타 없이 연속으로 통과한 지역 수. */
  const streak = (() => {
    let n = 0;
    for (let i = state.results.length - 1; i >= 0; i--) {
      if (state.results[i].skipped || state.results[i].errors > 0) break;
      n++;
    }
    return n;
  })();

  const type = useCallback((text: string) => {
    setState((s) => setInput(s, text, Date.now()));
  }, []);

  /** 엔터로 제출한다. 회상 모드에서만 뜻이 있다. */
  const submitAnswer = useCallback(() => {
    setState((s) => submit(s, Date.now()));
  }, []);

  const begin = useCallback(() => {
    setState((s) => start(s, Date.now()));
  }, []);

  const giveUpItem = useCallback(() => {
    setState((s) => giveUp(s, Date.now()));
  }, []);

  const skipReveal = useCallback(() => {
    setState((s) => settleReveal(s, Date.now()));
  }, []);

  const hint = useCallback(() => {
    setState((s) => revealHint(s, Date.now()));
  }, []);

  const restart = useCallback(() => {
    setState(createGame(items, config, Date.now(), seed));
  }, [items, config, seed]);

  return {
    state,
    now,
    /** 현재 목표 항목. 게임이 끝났으면 undefined. */
    current: state.items[state.index],
    remaining: remainingMs(state, now),
    score: score(state, now),
    /** 항목이 확정될 때마다 증가 — 입력창 초기화 이펙트의 의존값 */
    advancedAt,
    /** 정답 경로를 벗어날 때마다 증가 */
    erroredAt,
    /** 오답을 제출할 때마다 증가 */
    rejectedAt,
    /** 오타 없이 연속 통과한 지역 수 */
    streak,
    begin,
    type,
    submitAnswer,
    giveUpItem,
    skipReveal,
    hint,
    restart,
  };
}

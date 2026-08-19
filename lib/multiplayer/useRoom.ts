"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { connectSocket } from "./socket";
import type { RaceStart, RoomState } from "./types";

type Ack = { ok: boolean; roomId?: string; error?: string };

/**
 * 방 하나에 붙어 있는 동안의 소켓 연결을 관리한다.
 *
 * 연결을 컴포넌트 수명에 묶어 두는 것이 핵심이다. 방을 만든 뒤 다른 주소로
 * 이동하면 소켓이 끊겨 방장이 자기 방에서 빠져 버리므로, 화면 이동 없이
 * 이 훅을 쥔 컴포넌트가 계속 살아 있어야 한다.
 */
export function useRoom() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  /**
   * 내 소켓 id. ref로 렌더 중에 읽으면 연결이 끝나도 화면이 다시 그려지지 않아
   * 방장 판정이 조용히 틀어진다. 그래서 상태로 들고 간다.
   */
  const [selfId, setSelfId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [raceStart, setRaceStart] = useState<RaceStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * 연결 회차.
   *
   * 이 값이 바뀌면 아래 effect가 다시 돌면서 헌 소켓을 끊고 새것을 연다.
   * 방에서 나가는 유일한 방법이 연결을 끊는 것이라(서버는 소켓이 사라지는
   * 것으로 퇴장을 안다) 나갔다가 다시 만들거나 들어가려면 연결이 새로
   * 필요하다.
   */
  const [session, setSession] = useState(0);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSelfId(socket.id ?? null);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setError("서버에 연결하지 못했습니다"));
    socket.on("room:state", (state: RoomState) => setRoom(state));
    socket.on("race:start", (payload: RaceStart) => setRaceStart(payload));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session]);

  /**
   * 방에서 나간다.
   *
   * 여태 이 자리에 있던 것은 홈으로 가는 링크였다. 실제로 방에서 빠지긴 했다 —
   * 화면을 옮기면 이 훅을 쥔 컴포넌트가 사라지고 소켓이 끊기니까. 다만 그게
   * 나가는 문이라는 것이 이름에도 목적지에도 안 적혀 있었다. `← 시군 타이핑`은
   * 한 칸 위로 가는 링크의 문법이고, 대결에서 한 칸 위는 홈이 아니라 대결이다.
   *
   * 화면을 옮기지 않고 연결만 새로 연다. 서버가 보는 것은 전과 똑같은 퇴장이고,
   * 나간 사람은 대결 첫 화면(방 만들기·들어가기)에 그대로 선다 — 한 판 더
   * 하려는 사람이 가장 자주 원하는 자리다.
   */
  const leave = useCallback(() => {
    setRoom(null);
    setRaceStart(null);
    setError(null);
    setSelfId(null);
    setSession((n) => n + 1);
  }, []);

  const create = useCallback(
    (courseId: string, nickname: string) =>
      new Promise<boolean>((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve(false);
        setError(null);
        socket.emit("room:create", { courseId, nickname }, (ack: Ack) => {
          if (!ack?.ok) setError(ack?.error ?? "방을 만들지 못했습니다");
          resolve(Boolean(ack?.ok));
        });
      }),
    [],
  );

  const join = useCallback(
    (roomId: string, nickname: string) =>
      new Promise<boolean>((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve(false);
        setError(null);
        socket.emit(
          "room:join",
          { roomId: roomId.trim().toUpperCase(), nickname },
          (ack: Ack) => {
            if (!ack?.ok) setError(ack?.error ?? "방에 들어가지 못했습니다");
            resolve(Boolean(ack?.ok));
          },
        );
      }),
    [],
  );

  const setReady = useCallback((ready: boolean) => {
    socketRef.current?.emit("room:ready", { ready });
  }, []);

  const start = useCallback(() => {
    setError(null);
    socketRef.current?.emit("room:start", {}, (ack: Ack) => {
      if (!ack?.ok) setError(startError(ack?.error));
    });
  }, []);

  /** 다음 판으로 하고 싶은 코스. 같은 것을 다시 부르면 취소된다. */
  const nominate = useCallback((courseId: string | null) => {
    socketRef.current?.emit("room:nominate", { courseId: courseId ?? "" });
  }, []);

  /** 같은 방에서 다음 판. 코스를 안 주면 표가 가장 많은 것으로 간다. */
  const next = useCallback((courseId?: string) => {
    setError(null);
    socketRef.current?.emit("room:next", { courseId }, (ack: Ack) => {
      if (!ack?.ok) setError(nextError(ack?.error));
    });
  }, []);

  /** 규칙 바꾸기. 방장이 아니면 서버가 무시한다. */
  const setRules = useCallback((rules: { hint?: boolean; skip?: boolean }) => {
    socketRef.current?.emit("room:rules", rules);
  }, []);

  const sendProgress = useCallback(
    (update: { index: number; solved: number; cpm: number; accuracy: number }) => {
      socketRef.current?.emit("race:progress", update);
    },
    [],
  );

  const sendFinish = useCallback(() => {
    socketRef.current?.emit("race:finish");
  }, []);

  /** 막혀서 판에서 내려온다. 등수 없이 미완주로 남는다. */
  const sendGiveUp = useCallback(() => {
    socketRef.current?.emit("race:giveup");
  }, []);

  return {
    connected,
    room,
    raceStart,
    error,
    selfId,
    create,
    join,
    leave,
    setReady,
    setRules,
    start,
    nominate,
    next,
    sendProgress,
    sendFinish,
    sendGiveUp,
  };
}

/** 다음 판을 못 열었을 때. */
function nextError(code?: string): string {
  switch (code) {
    case "not_host":
      return "방장만 다음 판을 열 수 있습니다";
    case "not_finished":
      return "아직 판이 끝나지 않았습니다";
    default:
      return "다음 판을 열지 못했습니다";
  }
}

/** 서버가 주는 코드를 사람이 읽을 말로 바꾼다. */
function startError(code?: string): string {
  switch (code) {
    case "not_host":
      return "방장만 출발시킬 수 있습니다";
    case "not_ready":
      return "아직 준비하지 않은 사람이 있습니다";
    case "already_started":
      return "이미 시작한 방입니다";
    case "no_players":
      return "방에 아무도 없습니다";
    default:
      return "출발시키지 못했습니다";
  }
}

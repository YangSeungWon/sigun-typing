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

  const sendProgress = useCallback(
    (update: { index: number; cpm: number; accuracy: number }) => {
      socketRef.current?.emit("race:progress", update);
    },
    [],
  );

  const sendFinish = useCallback(() => {
    socketRef.current?.emit("race:finish");
  }, []);

  return {
    connected,
    room,
    raceStart,
    error,
    selfId,
    create,
    join,
    setReady,
    start,
    sendProgress,
    sendFinish,
  };
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

"use client";

import { readText, writeText } from "../storage";
import type { GameState, ModeId, Score } from "../game/types";

const DEVICE_KEY = "sigun:device";
const NICKNAME_KEY = "sigun:nickname";

/**
 * 로그인 없이 기록을 남기기 위한 익명 기기 식별자.
 * 개인정보를 담지 않으며, 서버에서는 제출 빈도 제한에만 쓴다.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  const saved = readText(DEVICE_KEY);
  if (saved) return saved;
  const id = crypto.randomUUID();
  writeText(DEVICE_KEY, id);
  return id;
}

export function getSavedNickname(): string {
  return readText(NICKNAME_KEY) ?? "";
}

export function saveNickname(name: string) {
  writeText(NICKNAME_KEY, name);
}

/** 게임 시작 시 서명된 토큰을 받아 둔다. 실패하면 기록만 못 남기고 게임은 계속된다. */
export async function requestToken(
  courseId: string,
  mode: ModeId,
  seed: number,
): Promise<string | null> {
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, mode, seed }),
    });
    if (!res.ok) return null;
    return (await res.json()).token ?? null;
  } catch {
    return null;
  }
}

export interface SubmitOutcome {
  ok: boolean;
  rank?: number | null;
  error?: string;
}

export async function submitScore(input: {
  token: string;
  courseId: string;
  mode: ModeId;
  seed: number;
  nickname: string;
  state: GameState;
  score: Score;
}): Promise<SubmitOutcome> {
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: input.token,
        courseId: input.courseId,
        mode: input.mode,
        seed: input.seed,
        nickname: input.nickname,
        deviceId: getDeviceId(),
        keystrokes: input.state.keystrokes,
        results: input.state.results,
        hintsUsed: input.state.hintsUsed,
        claimed: input.score,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "제출에 실패했습니다" };
    return { ok: true, rank: data.rank };
  } catch {
    return { ok: false, error: "서버에 연결하지 못했습니다" };
  }
}

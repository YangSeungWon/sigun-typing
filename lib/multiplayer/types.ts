import type { ModeId } from "../game/types";

/** 서버가 room:state로 보내는 그대로. server/rooms.ts의 Player와 짝을 맞춘다. */
export interface RoomPlayer {
  id: string;
  nickname: string;
  ready: boolean;
  index: number;
  cpm: number;
  accuracy: number;
  finishedAt: number | null;
  rank: number | null;
  connected: boolean;
}

export interface RoomState {
  id: string;
  courseId: string;
  mode: ModeId;
  seed: number;
  total: number;
  status: "waiting" | "counting" | "racing" | "finished";
  hostId: string | null;
  startsAt: number | null;
  /** 이미 순위대로 정렬되어 온다 */
  players: RoomPlayer[];
}

/** 출발 신호. 토큰은 완주 후 랭킹 제출에 그대로 쓴다. */
export interface RaceStart {
  startsAt: number;
  token: string;
}

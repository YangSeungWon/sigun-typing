import type { ModeId } from "../game/types";

/** 서버가 room:state로 보내는 그대로. server/rooms.ts의 Player와 짝을 맞춘다. */
export interface RoomPlayer {
  id: string;
  nickname: string;
  ready: boolean;
  index: number;
  /** 그중 맞힌 수. 순위는 이것이 먼저다. */
  solved: number;
  cpm: number;
  accuracy: number;
  finishedAt: number | null;
  rank: number | null;
  /** 스스로 판에서 내려왔는가. 등수를 안 준다. */
  quit: boolean;
  connected: boolean;
  /** 다음 판으로 이 코스를 하자는 추천. 한 사람에 하나. */
  pick: string | null;
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
  /** 이 방에서 몇 번째 판인가. 1부터. */
  round: number;
  /** 이 방의 규칙. 방장이 정하고 모두가 본다. */
  rules: { hint: boolean; skip: boolean };
  /** 다음 판 후보. 표가 많은 순으로 온다. */
  picks: { courseId: string; votes: number }[];
  /** 이미 순위대로 정렬되어 온다 */
  players: RoomPlayer[];
}

/** 출발 신호. 토큰은 완주 후 랭킹 제출에 그대로 쓴다. */
export interface RaceStart {
  startsAt: number;
  token: string;
}

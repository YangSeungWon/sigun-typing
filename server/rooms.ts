import type { ModeId } from "../lib/game/types";

/**
 * 멀티플레이 방의 규칙 전부. 소켓을 모르는 순수 함수라 테스트할 수 있다.
 *
 * 소켓 계층은 이 함수들을 부르고 결과를 뿌리기만 한다. 경주 규칙과 전송을
 * 섞어 두면 "접속이 끊긴 상태에서 호스트가 나가면?" 같은 경우를 확인할 방법이 없다.
 */

export type RoomStatus = "waiting" | "counting" | "racing" | "finished";

/**
 * 방의 규칙.
 *
 * 방장이 정하지만 **모두가 본다.** 무슨 규칙으로 겨루는지 모르고 달리게 하면
 * 안 된다. 판이 시작되면 못 바꾼다 — 달리는 중에 규칙이 바뀌면 먼저 지나간
 * 사람과 나중에 지나간 사람이 다른 게임을 한 것이 된다.
 */
export interface RoomRules {
  /** 초성 힌트(Tab). */
  hint: boolean;
  /** 모르겠으면 넘기기(Esc). 넘긴 곳은 맞힌 것으로 안 센다. */
  skip: boolean;
}

/** 기본은 힌트만. 패스는 켜는 사람이 켠다. */
export const DEFAULT_RULES: RoomRules = { hint: true, skip: false };

export const MAX_PLAYERS = 8;
export const COUNTDOWN_MS = 3_000;
/** 아무도 움직이지 않는 방을 영원히 붙들고 있지 않는다. */
export const ROOM_IDLE_MS = 30 * 60 * 1000;

export interface Player {
  /** 소켓 id */
  id: string;
  nickname: string;
  ready: boolean;
  /** 지금까지 지나온 지역 수. 패스한 것도 포함한다 — 진행한 자리다. */
  index: number;
  /** 그중 **맞힌** 수. 순위는 이것이 먼저다. */
  solved: number;
  cpm: number;
  accuracy: number;
  finishedAt: number | null;
  /**
   * 등수. `standings`가 매번 다시 매긴다 — 맞힌 개수가 먼저이고 시간이 다음이라,
   * 완주하는 순간에는 아직 정해지지 않는다. 끝까지 못 간 사람은 null.
   */
  rank: number | null;
  /** 판에서 스스로 내려왔는가. 등수를 안 준다. */
  quit: boolean;
  connected: boolean;
  /** 다음 판으로 이 코스를 하자는 추천. 한 사람에 하나. */
  pick: string | null;
}

export interface Room {
  id: string;
  courseId: string;
  mode: ModeId;
  seed: number;
  /** 코스 항목 수 */
  total: number;
  hostId: string | null;
  status: RoomStatus;
  players: Player[];
  /** 카운트다운이 끝나고 실제로 출발하는 서버 시각 */
  startsAt: number | null;
  /** 이 방에서 몇 번째 판인가. 1부터. */
  round: number;
  /** 이 방의 규칙. 방장이 정하고 모두가 본다. */
  rules: RoomRules;
  updatedAt: number;
}

export type RoomError =
  | "room_full"
  | "already_started"
  | "not_host"
  | "not_ready"
  | "no_players"
  | "not_racing"
  | "not_finished"
  | "no_course";

export type RoomResult<T> = { ok: true; value: T } | { ok: false; error: RoomError };

const ok = <T>(value: T): RoomResult<T> => ({ ok: true, value });
const err = <T>(error: RoomError): RoomResult<T> => ({ ok: false, error });

export function createRoom(input: {
  id: string;
  courseId: string;
  mode: ModeId;
  seed: number;
  total: number;
  now: number;
}): Room {
  return {
    id: input.id,
    courseId: input.courseId,
    mode: input.mode,
    seed: input.seed,
    total: input.total,
    hostId: null,
    status: "waiting",
    players: [],
    startsAt: null,
    round: 1,
    rules: DEFAULT_RULES,
    updatedAt: input.now,
  };
}

/** 규칙을 바꾼다. 방장만, 대기실에서만. */
export function setRules(
  room: Room,
  playerId: string,
  rules: Partial<RoomRules>,
  now: number,
): RoomResult<Room> {
  if (room.hostId !== playerId) return err("not_host");
  if (room.status !== "waiting") return err("already_started");
  return ok({ ...room, rules: { ...room.rules, ...rules }, updatedAt: now });
}

export function join(
  room: Room,
  player: { id: string; nickname: string },
  now: number,
): RoomResult<Room> {
  /*
   * 끝난 방에도 들어올 수 있다.
   *
   * 한 판이 끝나면 방이 그대로 남아 다음 코스로 이어진다. 그 사이에 도착한
   * 사람을 문 앞에서 돌려보내면, 링크를 받고 뒤늦게 온 친구는 영영 못 들어온다.
   */
  if (room.status !== "waiting" && room.status !== "finished") {
    return err("already_started");
  }
  if (room.players.filter((p) => p.connected).length >= MAX_PLAYERS) {
    return err("room_full");
  }

  const entry: Player = {
    id: player.id,
    nickname: player.nickname,
    ready: false,
    index: 0,
    solved: 0,
    cpm: 0,
    accuracy: 1,
    finishedAt: null,
    rank: null,
    quit: false,
    connected: true,
    pick: null,
  };

  return ok({
    ...room,
    // 먼저 들어온 사람이 방장이 된다.
    hostId: room.hostId ?? player.id,
    players: [...room.players, entry],
    updatedAt: now,
  });
}

export function setReady(room: Room, playerId: string, ready: boolean, now: number): Room {
  return {
    ...room,
    players: room.players.map((p) => (p.id === playerId ? { ...p, ready } : p)),
    updatedAt: now,
  };
}

/** 방장이 출발을 누르면 카운트다운이 시작된다. */
export function startCountdown(
  room: Room,
  playerId: string,
  now: number,
): RoomResult<Room> {
  if (room.status !== "waiting") return err("already_started");
  if (room.hostId !== playerId) return err("not_host");

  const active = room.players.filter((p) => p.connected);
  if (active.length === 0) return err("no_players");
  // 방장은 누른 것으로 준비를 갈음한다. 나머지는 명시적으로 준비해야 한다.
  if (!active.every((p) => p.ready || p.id === room.hostId)) return err("not_ready");

  return ok({
    ...room,
    status: "counting",
    startsAt: now + COUNTDOWN_MS,
    updatedAt: now,
  });
}

/** 카운트다운이 끝났는지 확인해 상태를 넘긴다. 소켓 계층이 주기적으로 부른다. */
export function tick(room: Room, now: number): Room {
  if (room.status === "counting" && room.startsAt !== null && now >= room.startsAt) {
    return { ...room, status: "racing", updatedAt: now };
  }
  return room;
}

export function progress(
  room: Room,
  playerId: string,
  update: { index: number; solved: number; cpm: number; accuracy: number },
  now: number,
): RoomResult<Room> {
  if (room.status !== "racing") return err("not_racing");

  return ok({
    ...room,
    players: room.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            // 진행도는 되돌아가지 않는다. 뒤늦게 도착한 패킷이 순위를 흔들지 않게 한다.
            index: Math.max(p.index, Math.min(update.index, room.total)),
            solved: Math.max(p.solved, Math.min(update.solved, room.total)),
            cpm: Math.max(0, update.cpm),
            accuracy: Math.min(1, Math.max(0, update.accuracy)),
          }
        : p,
    ),
    updatedAt: now,
  });
}

/**
 * 끝까지 갔다.
 *
 * 등수를 여기서 매기지 않는다. 순위는 **맞힌 개수가 먼저이고 시간이 다음**이라,
 * 먼저 들어왔다고 앞선다는 보장이 없다 — 패스를 켜면 열넷 맞히고 빨리 들어온
 * 사람이 열일곱 맞히고 늦게 들어온 사람 뒤에 서야 한다. 그건 다 들어와 봐야
 * 아는 것이므로 `standings`가 매길 일이다.
 */
export function finish(room: Room, playerId: string, now: number): Room {
  const already = room.players.find((p) => p.id === playerId)?.finishedAt !== null;
  if (already) return room;

  const players = room.players.map((p) =>
    p.id === playerId ? { ...p, finishedAt: now, index: room.total } : p,
  );

  return closeIfDone({ ...room, players, updatedAt: now });
}

/**
 * 나간 사람을 어떻게 둘 것인가.
 *
 * **대기실에서 나가면 지운다.** 아직 아무것도 안 했으므로 남길 것이 없고,
 * 유령이 앉아 있으면 `전원이 준비하면 출발할 수 있습니다`와 어긋나 보인다.
 * 끊겼다 돌아와도 소켓 id가 새것이라 어차피 새 사람으로 들어온다.
 *
 * **달리는 중이거나 끝난 뒤에 나가면 남긴다.** 같이 달리던 사람이고, 어디까지
 * 갔는지가 그 판의 기록이다. 완주하고 나갔으면 등수도 그대로 둔다 — 뛴 것은
 * 뛴 것이다. 화면에서는 흐리게, `나감`으로 적힌다.
 */
/**
 * 그만하기.
 *
 * **방이 끝나려면 모두가 끝나야 한다.** 그런데 한 사람이 한 지역에서 영영
 * 막히면 그 방은 영영 `racing`이다 — 먼저 끝낸 사람들은 나가는 것 말고 할 수
 * 있는 게 없다. 겨루는 판이라 건너뛰기를 안 여는 것과, 판에서 내려올 길이
 * 없는 것은 다른 문제다.
 *
 * 등수는 안 준다. 끝까지 간 사람과 같은 줄에 세울 수 없다. 어디까지 갔는지는
 * 그대로 남아 순위표에 미완주로 적힌다.
 */
export function giveUp(room: Room, playerId: string, now: number): Room {
  if (room.status !== "racing" && room.status !== "counting") return room;
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.finishedAt !== null) return room;

  return closeIfDone({
    ...room,
    players: room.players.map((p) =>
      p.id === playerId ? { ...p, finishedAt: now, quit: true } : p,
    ),
    updatedAt: now,
  });
}

export function leave(room: Room, playerId: string, now: number): Room {
  const players =
    room.status === "waiting"
      ? room.players.filter((p) => p.id !== playerId)
      : room.players.map((p) =>
          p.id === playerId ? { ...p, connected: false, ready: false } : p,
        );

  // 방장이 나가면 남은 사람 중 먼저 들어온 사람이 이어받는다.
  const hostGone = room.hostId === playerId;
  const nextHost = players.find((p) => p.connected)?.id ?? null;

  return closeIfDone({
    ...room,
    players,
    hostId: hostGone ? nextHost : room.hostId,
    updatedAt: now,
  });
}

/** 경주 중이던 사람이 모두 끝났거나 나갔으면 방을 닫는다. */
function closeIfDone(room: Room): Room {
  if (room.status !== "racing" && room.status !== "counting") return room;
  const running = room.players.filter((p) => p.connected && p.finishedAt === null);
  if (running.length > 0) return room;
  return { ...room, status: "finished" };
}

/**
 * 다음 판으로 할 코스를 추천한다. 한 사람에 하나이고, 다시 부르면 바뀐다.
 *
 * 정하는 것은 여전히 방장이다. 표가 결정을 대신하면 여덟 명이 다 고를 때까지
 * 아무도 시작을 못 하고, 한 명이 안 고르면 방이 멈춘다. 여기서 표가 하는 일은
 * **방장에게 무엇을 하고 싶은지 알려 주는 것**이다.
 */
export function nominate(
  room: Room,
  playerId: string,
  courseId: string | null,
  now: number,
): Room {
  return {
    ...room,
    players: room.players.map((p) => (p.id === playerId ? { ...p, pick: courseId } : p)),
    updatedAt: now,
  };
}

/** 추천을 많은 순으로 센다. 같은 표면 먼저 고른 쪽이 앞이다. */
export function tally(room: Room): { courseId: string; votes: number }[] {
  const counts = new Map<string, number>();
  for (const p of room.players) {
    if (!p.connected || !p.pick) continue;
    counts.set(p.pick, (counts.get(p.pick) ?? 0) + 1);
  }
  return [...counts]
    .map(([courseId, votes]) => ({ courseId, votes }))
    .sort((a, b) => b.votes - a.votes);
}

/**
 * 같은 방에서 다음 판을 연다.
 *
 * 방을 새로 파지 않는다. 한 판 끝날 때마다 코드를 다시 부르고 링크를 다시
 * 보내야 한다면, 그건 친구들과 한 판 더 하는 자리가 아니라 매번 처음부터
 * 모이는 자리다.
 *
 * 달린 기록은 지운다 — 남겨 두면 다음 판 순위표에 지난 판 등수가 섞인다.
 * 추천도 지운다. 그 추천은 이번 판을 고르려던 것이었다.
 */
export function nextRound(
  room: Room,
  input: { playerId: string; courseId: string; seed: number; total: number; now: number },
): RoomResult<Room> {
  if (room.hostId !== input.playerId) return err("not_host");
  if (room.status !== "finished") return err("not_finished");
  if (!input.courseId) return err("no_course");

  return ok({
    ...room,
    courseId: input.courseId,
    seed: input.seed,
    total: input.total,
    status: "waiting",
    startsAt: null,
    round: room.round + 1,
    /*
     * 나간 사람은 여기서 지운다. 지난 판을 같이 뛴 사람이지 이번 판 사람이
     * 아니다. 안 지우면 방이 이어질수록 유령이 쌓여 순위표가 길어진다.
     */
    players: room.players.filter((p) => p.connected).map((p) => ({
      ...p,
      ready: false,
      index: 0,
      solved: 0,
      cpm: 0,
      accuracy: 1,
      finishedAt: null,
      rank: null,
      quit: false,
      pick: null,
    })),
    updatedAt: input.now,
  });
}

/**
 * 순위표. 등수도 여기서 매긴다.
 *
 * **맞힌 개수가 먼저, 시간이 다음이다.** 완주 순서로만 매기면 넘길 수 있는
 * 판에서 다 넘긴 사람이 1등이 된다. 열넷 맞히고 1분에 들어온 사람은 열일곱
 * 맞히고 2분에 들어온 사람 뒤다.
 *
 * 이 규칙은 패스가 꺼진 판의 결과를 바꾸지 않는다 — 그때는 모두가 다 맞혀야
 * 끝나므로 맞힌 개수가 같고, 남는 것은 시간뿐이다.
 *
 * 스스로 내려온 사람에게는 등수를 안 준다. 끝까지 간 사람과 같은 줄에 세울 수
 * 없다. 아직 달리는 사람과 함께 아래에 진행도순으로 선다.
 */
export function standings(room: Room): Player[] {
  const done = room.players
    .filter((p) => p.finishedAt !== null && !p.quit)
    .sort((a, b) => b.solved - a.solved || a.finishedAt! - b.finishedAt!);
  const rankOf = new Map(done.map((p, i) => [p.id, i + 1]));

  return room.players
    .map((p) => ({ ...p, rank: rankOf.get(p.id) ?? null }))
    .sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      if (b.solved !== a.solved) return b.solved - a.solved;
      if (b.index !== a.index) return b.index - a.index;
      return b.cpm - a.cpm;
    });
}

export function isAbandoned(room: Room, now: number): boolean {
  if (room.players.some((p) => p.connected)) return false;
  return now - room.updatedAt > ROOM_IDLE_MS;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 헷갈리는 글자(O/0, I/1)를 뺀 6자리 코드. 말로 불러 주기 위한 것이다. */
export function makeRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

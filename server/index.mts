import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { getCourse } from "../data/courses/index.ts";
import { isModeId } from "../lib/game/modes.ts";
import type { ModeId } from "../lib/game/types.ts";
import { issueToken, secretFingerprint } from "../lib/score/session.ts";
import {
  createRoom,
  finish,
  isAbandoned,
  join,
  leave,
  makeRoomCode,
  nextRound,
  nominate,
  progress,
  setReady,
  standings,
  startCountdown,
  tally,
  tick,
  type Room,
} from "./rooms.ts";

/**
 * 멀티플레이 소켓 서버. Next와 같은 저장소에 있지만 별도 프로세스로 뜬다.
 *
 * 규칙은 전부 rooms.ts에 있고 여기서는 소켓 이벤트를 그 함수들에 연결하기만 한다.
 *
 * 기록 검증 토큰을 이 서버가 직접 발급하는 이유: 경주 출발 시각을 권위 있게
 * 아는 쪽이 여기이기 때문이다. 클라이언트는 완주 후 그 토큰으로 평소처럼
 * /api/scores에 제출하고, 싱글과 똑같은 검증을 거친다.
 */

const PORT = Number(process.env.SOCKET_PORT ?? 4000);
const ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";
const TICK_MS = 250;

const rooms = new Map<string, Room>();
/** 소켓이 어느 방에 있는지. 끊겼을 때 방을 찾아야 한다. */
const roomOf = new Map<string, string>();

const httpServer = createServer((req, res) => {
  // 컨테이너 헬스체크용. 그 외 경로는 소켓 전용이다.
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
});

function cleanNickname(raw: unknown): string {
  if (typeof raw !== "string") return "익명";
  const name = raw.replace(/[\p{C}]/gu, "").trim().slice(0, 12);
  return name || "익명";
}

/** 방 상태를 그 방의 모두에게 보낸다. 화면은 이 한 이벤트만 보고 그린다. */
function publish(room: Room) {
  io.to(room.id).emit("room:state", {
    id: room.id,
    courseId: room.courseId,
    mode: room.mode,
    seed: room.seed,
    total: room.total,
    status: room.status,
    hostId: room.hostId,
    startsAt: room.startsAt,
    round: room.round,
    /* 다음 판 후보. 방장이 무엇을 고를지 정하는 데 쓰고, 모두가 함께 본다. */
    picks: tally(room),
    players: standings(room),
  });
}

function save(room: Room) {
  rooms.set(room.id, room);
  publish(room);
}

io.on("connection", (socket: Socket) => {
  socket.on(
    "room:create",
    (
      payload: { courseId?: string; mode?: string; nickname?: string },
      ack?: (res: unknown) => void,
    ) => {
      const course = getCourse(String(payload?.courseId ?? ""));
      if (!course) return ack?.({ ok: false, error: "없는 코스입니다" });

      const mode: ModeId =
        payload?.mode && isModeId(payload.mode) ? payload.mode : "multi";

      // 같은 방의 모두가 같은 순서를 봐야 하므로 시드는 방이 정한다.
      let id = makeRoomCode();
      while (rooms.has(id)) id = makeRoomCode();

      const room = createRoom({
        id,
        courseId: course.id,
        mode,
        seed: Math.floor(Math.random() * 2 ** 31),
        total: course.regions.length,
        now: Date.now(),
      });
      rooms.set(id, room);

      ack?.({ ok: true, roomId: id });
      joinRoom(socket, id, cleanNickname(payload?.nickname));
    },
  );

  socket.on(
    "room:join",
    (payload: { roomId?: string; nickname?: string }, ack?: (res: unknown) => void) => {
      const id = String(payload?.roomId ?? "").toUpperCase();
      if (!rooms.has(id)) return ack?.({ ok: false, error: "없는 방입니다" });
      const result = joinRoom(socket, id, cleanNickname(payload?.nickname));
      ack?.(result);
    },
  );

  socket.on("room:ready", (payload: { ready?: boolean }) => {
    const room = currentRoom(socket);
    if (!room) return;
    save(setReady(room, socket.id, Boolean(payload?.ready), Date.now()));
  });

  /*
   * 다음 판 코스 추천. 한 사람에 하나다.
   *
   * 없는 코스를 보내면 무시한다 — 방 화면의 목록에서 고르게 되어 있지만,
   * 소켓은 아무나 아무 말이나 보낼 수 있는 문이다.
   */
  socket.on("room:nominate", (payload: { courseId?: unknown }) => {
    const room = currentRoom(socket);
    if (!room) return;
    const raw = typeof payload?.courseId === "string" ? payload.courseId : "";
    const course = raw ? getCourse(raw) : null;
    if (raw && !course) return;
    save(nominate(room, socket.id, course?.id ?? null, Date.now()));
  });

  /*
   * 같은 방에서 다음 판.
   *
   * 코스를 안 실어 보내면 표가 가장 많은 것으로, 표도 없으면 방금 한 코스를
   * 한 번 더 한다. 방장이 아무것도 안 골라도 단추 하나로 이어진다.
   */
  socket.on("room:next", (payload: { courseId?: unknown }, ack?: (res: unknown) => void) => {
    const room = currentRoom(socket);
    if (!room) return ack?.({ ok: false, error: "방에 있지 않습니다" });

    const asked = typeof payload?.courseId === "string" ? payload.courseId : "";
    const wanted = asked || tally(room)[0]?.courseId || room.courseId;
    const course = getCourse(wanted);
    if (!course) return ack?.({ ok: false, error: "없는 코스입니다" });

    const result = nextRound(room, {
      playerId: socket.id,
      courseId: course.id,
      // 같은 방의 모두가 같은 순서를 봐야 하므로 시드는 방이 정한다. 판마다 새로.
      seed: Math.floor(Math.random() * 2 ** 31),
      total: course.regions.length,
      now: Date.now(),
    });
    if (!result.ok) return ack?.({ ok: false, error: result.error });

    save(result.value);
    ack?.({ ok: true });
  });

  socket.on("room:start", (_payload: unknown, ack?: (res: unknown) => void) => {
    const room = currentRoom(socket);
    if (!room) return ack?.({ ok: false, error: "방에 있지 않습니다" });

    const result = startCountdown(room, socket.id, Date.now());
    if (!result.ok) return ack?.({ ok: false, error: result.error });

    save(result.value);
    ack?.({ ok: true });
  });

  socket.on("race:progress", (payload: { index?: number; cpm?: number; accuracy?: number }) => {
    const room = currentRoom(socket);
    if (!room) return;
    const result = progress(
      room,
      socket.id,
      {
        index: Number(payload?.index) || 0,
        cpm: Number(payload?.cpm) || 0,
        accuracy: Number(payload?.accuracy) || 0,
      },
      Date.now(),
    );
    if (result.ok) save(result.value);
  });

  socket.on("race:finish", () => {
    const room = currentRoom(socket);
    if (!room) return;
    save(finish(room, socket.id, Date.now()));
  });

  socket.on("disconnect", () => {
    const room = currentRoom(socket);
    roomOf.delete(socket.id);
    if (!room) return;
    save(leave(room, socket.id, Date.now()));
  });
});

function currentRoom(socket: Socket): Room | undefined {
  const id = roomOf.get(socket.id);
  return id ? rooms.get(id) : undefined;
}

function joinRoom(socket: Socket, roomId: string, nickname: string) {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: "없는 방입니다" };

  const result = join(room, { id: socket.id, nickname }, Date.now());
  if (!result.ok) return { ok: false, error: result.error };

  socket.join(roomId);
  roomOf.set(socket.id, roomId);
  save(result.value);
  return { ok: true, roomId };
}

/**
 * 카운트다운을 넘기고, 출발하는 순간 각자에게 검증 토큰을 보낸다.
 * 버려진 방도 여기서 치운다.
 */
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (isAbandoned(room, now)) {
      rooms.delete(id);
      continue;
    }

    const next = tick(room, now);
    if (next.status === "racing" && room.status === "counting") {
      rooms.set(id, next);
      for (const player of next.players) {
        if (!player.connected) continue;
        const { token } = issueToken(
          {
            courseId: next.courseId,
            // 방을 만들 때 확인한 코스의 판번호를 그대로 쓴다.
            courseVersion: getCourse(next.courseId)?.version ?? 1,
            mode: next.mode,
            seed: next.seed,
          },
          now,
        );
        io.to(player.id).emit("race:start", { startsAt: next.startsAt, token });
      }
      publish(next);
    }
  }
}, TICK_MS);

/**
 * 잡히지 않은 오류.
 *
 * 이대로 두면 프로세스가 조용히 죽고 컨테이너가 재시작되면서, 방에 있던
 * 사람들만 이유 없이 튕긴다. 최소한 로그에 남겨야 나중에 맞춰 볼 수 있다.
 * `[error]`로 시작하는 것은 웹 쪽과 같은 방식으로 grep하기 위해서다.
 */
process.on("uncaughtException", (err) => {
  process.stderr.write(`[error] socket uncaught — ${err.message}\n${err.stack}\n`);
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[error] socket unhandled — ${String(reason)}\n`);
});

httpServer.listen(PORT, () => {
  process.stdout.write(`소켓 서버 http://localhost:${PORT} (허용 출처 ${ORIGIN})\n`);
  // 웹이 찍는 지문과 같아야 한다. 다르면 멀티 기록만 조용히 거부된다.
  process.stdout.write(`[socket] 기록 서명 키 지문 ${secretFingerprint()}\n`);
});

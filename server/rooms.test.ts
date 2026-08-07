import { describe, expect, it } from "vitest";
import {
  COUNTDOWN_MS,
  MAX_PLAYERS,
  createRoom,
  finish,
  isAbandoned,
  join,
  leave,
  makeRoomCode,
  progress,
  setReady,
  standings,
  startCountdown,
  tick,
  type Room,
} from "./rooms";

const T0 = 1_000_000;

function room(): Room {
  return createRoom({
    id: "ABC123",
    courseId: "sido",
    mode: "multi",
    seed: 7,
    total: 17,
    now: T0,
  });
}

function withPlayers(...names: string[]): Room {
  let r = room();
  names.forEach((name, i) => {
    const result = join(r, { id: `s${i}`, nickname: name }, T0);
    if (!result.ok) throw new Error(result.error);
    r = result.value;
  });
  return r;
}

/** 방장 포함 전원 준비시키고 출발 직전까지 진행한다. */
function racing(...names: string[]): Room {
  let r = withPlayers(...names);
  r.players.forEach((p) => {
    r = setReady(r, p.id, true, T0);
  });
  const started = startCountdown(r, r.hostId!, T0);
  if (!started.ok) throw new Error(started.error);
  return tick(started.value, T0 + COUNTDOWN_MS);
}

describe("입장", () => {
  it("먼저 들어온 사람이 방장이 된다", () => {
    const r = withPlayers("하나", "둘");
    expect(r.hostId).toBe("s0");
    expect(r.players).toHaveLength(2);
  });

  it("정원을 넘으면 거부한다", () => {
    const names = Array.from({ length: MAX_PLAYERS }, (_, i) => `p${i}`);
    const full = withPlayers(...names);
    const extra = join(full, { id: "x", nickname: "늦은사람" }, T0);
    expect(extra).toEqual({ ok: false, error: "room_full" });
  });

  it("이미 시작한 방에는 들어갈 수 없다", () => {
    const r = racing("하나");
    expect(join(r, { id: "x", nickname: "늦은사람" }, T0)).toEqual({
      ok: false,
      error: "already_started",
    });
  });
});

describe("출발", () => {
  it("방장이 아니면 출발시킬 수 없다", () => {
    const r = withPlayers("하나", "둘");
    expect(startCountdown(r, "s1", T0)).toEqual({ ok: false, error: "not_host" });
  });

  it("준비하지 않은 사람이 있으면 출발하지 않는다", () => {
    const r = withPlayers("하나", "둘");
    expect(startCountdown(r, "s0", T0)).toEqual({ ok: false, error: "not_ready" });
  });

  it("방장은 출발을 누른 것으로 준비를 갈음한다", () => {
    let r = withPlayers("하나", "둘");
    r = setReady(r, "s1", true, T0);
    const started = startCountdown(r, "s0", T0);
    expect(started.ok).toBe(true);
  });

  it("카운트다운이 끝나야 경주가 시작된다", () => {
    let r = withPlayers("혼자");
    r = setReady(r, "s0", true, T0);
    const started = startCountdown(r, "s0", T0);
    if (!started.ok) throw new Error(started.error);

    expect(started.value.status).toBe("counting");
    expect(started.value.startsAt).toBe(T0 + COUNTDOWN_MS);
    expect(tick(started.value, T0 + COUNTDOWN_MS - 1).status).toBe("counting");
    expect(tick(started.value, T0 + COUNTDOWN_MS).status).toBe("racing");
  });

  it("두 번 출발시킬 수 없다", () => {
    const r = racing("하나");
    expect(startCountdown(r, "s0", T0)).toEqual({ ok: false, error: "already_started" });
  });
});

describe("진행", () => {
  it("경주 중이 아니면 진행도를 받지 않는다", () => {
    const r = withPlayers("하나");
    expect(progress(r, "s0", { index: 3, cpm: 300, accuracy: 1 }, T0)).toEqual({
      ok: false,
      error: "not_racing",
    });
  });

  it("진행도는 뒤로 가지 않는다 — 늦게 도착한 패킷 방어", () => {
    let r = racing("하나");
    r = (progress(r, "s0", { index: 5, cpm: 300, accuracy: 1 }, T0) as { value: Room }).value;
    r = (progress(r, "s0", { index: 2, cpm: 300, accuracy: 1 }, T0) as { value: Room }).value;
    expect(r.players[0].index).toBe(5);
  });

  it("코스 길이를 넘는 진행도는 잘라 낸다", () => {
    let r = racing("하나");
    r = (progress(r, "s0", { index: 999, cpm: 300, accuracy: 1 }, T0) as { value: Room }).value;
    expect(r.players[0].index).toBe(17);
  });

  it("정확도는 0~1로 묶인다", () => {
    let r = racing("하나");
    r = (progress(r, "s0", { index: 1, cpm: -5, accuracy: 3 }, T0) as { value: Room }).value;
    expect(r.players[0].accuracy).toBe(1);
    expect(r.players[0].cpm).toBe(0);
  });
});

describe("완주와 순위", () => {
  it("완주 순서대로 등수가 매겨진다", () => {
    let r = racing("하나", "둘", "셋");
    r = finish(r, "s1", T0 + 10_000);
    r = finish(r, "s0", T0 + 12_000);
    expect(r.players.find((p) => p.id === "s1")!.rank).toBe(1);
    expect(r.players.find((p) => p.id === "s0")!.rank).toBe(2);
    expect(r.players.find((p) => p.id === "s2")!.rank).toBeNull();
  });

  it("같은 사람이 두 번 완주해도 등수가 밀리지 않는다", () => {
    let r = racing("하나", "둘");
    r = finish(r, "s0", T0 + 10_000);
    r = finish(r, "s0", T0 + 11_000);
    expect(r.players.find((p) => p.id === "s0")!.rank).toBe(1);
    expect(r.players.filter((p) => p.rank !== null)).toHaveLength(1);
  });

  it("모두 완주하면 방이 닫힌다", () => {
    let r = racing("하나", "둘");
    r = finish(r, "s0", T0 + 10_000);
    expect(r.status).toBe("racing");
    r = finish(r, "s1", T0 + 11_000);
    expect(r.status).toBe("finished");
  });

  it("순위표는 완주자를 먼저, 나머지는 진행도순으로 놓는다", () => {
    let r = racing("하나", "둘", "셋");
    r = (progress(r, "s1", { index: 9, cpm: 400, accuracy: 1 }, T0) as { value: Room }).value;
    r = (progress(r, "s2", { index: 4, cpm: 300, accuracy: 1 }, T0) as { value: Room }).value;
    r = finish(r, "s0", T0 + 10_000);
    expect(standings(r).map((p) => p.id)).toEqual(["s0", "s1", "s2"]);
  });
});

describe("이탈", () => {
  it("방장이 나가면 다음 사람이 이어받는다", () => {
    let r = withPlayers("하나", "둘");
    r = leave(r, "s0", T0);
    expect(r.hostId).toBe("s1");
  });

  it("경주 중 남은 사람이 모두 나가면 방이 닫힌다", () => {
    let r = racing("하나", "둘");
    r = leave(r, "s0", T0 + 5_000);
    expect(r.status).toBe("racing");
    r = leave(r, "s1", T0 + 6_000);
    expect(r.status).toBe("finished");
  });

  it("완주한 사람만 남아 있어도 방이 닫힌다", () => {
    let r = racing("하나", "둘");
    r = finish(r, "s0", T0 + 10_000);
    r = leave(r, "s1", T0 + 11_000);
    expect(r.status).toBe("finished");
  });

  it("아무도 없는 방은 일정 시간 뒤 버려진 것으로 본다", () => {
    let r = withPlayers("하나");
    r = leave(r, "s0", T0);
    expect(isAbandoned(r, T0 + 1_000)).toBe(false);
    expect(isAbandoned(r, T0 + 60 * 60 * 1000)).toBe(true);
  });
});

describe("방 코드", () => {
  it("헷갈리는 글자를 쓰지 않는다", () => {
    const rnd = (() => {
      let i = 0;
      return () => (i++ % 32) / 32;
    })();
    for (let i = 0; i < 50; i++) {
      expect(makeRoomCode(rnd)).not.toMatch(/[O0I1]/);
    }
  });

  it("여섯 자리다", () => {
    expect(makeRoomCode()).toHaveLength(6);
  });
});

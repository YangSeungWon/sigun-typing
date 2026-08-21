import { describe, expect, it } from "vitest";
import { MemoryScoreRepository, outranks } from "./repo";
import type { NewScoreRow } from "./schema";

const base: Omit<NewScoreRow, "sessionId" | "scoringVersion" | "courseVersion"> = {
  courseId: "sido",
  mode: "map",
  nickname: "테스터",
  deviceId: "dev-1",
  cpm: 300,
  accuracy: 1,
  hintsUsed: 0,
  elapsedMs: 10_000,
  correctKeystrokes: 50,
  totalErrors: 0,
  completed: 17,
  total: 17,
};

/**
 * 기록 한 줄. 순위는 완주 수와 시간으로 매겨지므로 그 둘로 만든다.
 * (cpm은 화면에 남는 값일 뿐 순위에 쓰이지 않는다.)
 */
function row(
  sessionId: string,
  scoringVersion: number,
  { completed = 17, elapsedMs = 10_000 }: { completed?: number; elapsedMs?: number } = {},
): NewScoreRow {
  return { ...base, sessionId, scoringVersion, courseVersion: 1, completed, elapsedMs };
}

describe("채점 버전", () => {
  it("순위표는 다른 버전의 기록을 섞지 않는다", async () => {
    const repo = new MemoryScoreRepository();
    await repo.insert(row("s1", 1, { elapsedMs: 50_000 }));
    await repo.insert(row("s2", 2, { elapsedMs: 90_000 }));

    const v1 = await repo.leaderboard("sido", "map", 10, 1, 1);
    expect(v1).toHaveLength(1);
    expect(v1[0].elapsedMs).toBe(50_000);

    const v2 = await repo.leaderboard("sido", "map", 10, 2, 1);
    expect(v2).toHaveLength(1);
    expect(v2[0].elapsedMs).toBe(90_000);
  });

  it("많이 끝낸 순, 같으면 빠른 순으로 선다", async () => {
    const repo = new MemoryScoreRepository();
    await repo.insert(row("느림", 1, { elapsedMs: 90_000 }));
    await repo.insert(row("빠름", 1, { elapsedMs: 30_000 }));
    await repo.insert(row("덜 끝냄", 1, { completed: 10, elapsedMs: 10_000 }));
    const board = await repo.leaderboard("sido", "map", 10, 1, 1);
    // 10곳을 10초에 끝낸 판이 17곳을 90초에 끝낸 판을 이기지 않는다.
    expect(board.map((e) => e.elapsedMs)).toEqual([30_000, 90_000, 10_000]);
  });

  it("같은 세션은 한 번만 저장된다", async () => {
    const repo = new MemoryScoreRepository();
    expect(await repo.insert(row("dup", 1, { elapsedMs: 40_000 }))).toBe(true);
    expect(await repo.insert(row("dup", 1, { elapsedMs: 90_000 }))).toBe(false);
    expect(await repo.leaderboard("sido", "map", 10, 1, 1)).toHaveLength(1);
  });
});

describe("기간 필터", () => {
  const at = (iso: string) => new Date(iso);

  async function seed() {
    const repo = new MemoryScoreRepository();
    // MemoryScoreRepository는 createdAt을 스스로 찍으므로 직접 넣어 준다.
    const rows = [
      { session: "old", elapsedMs: 30_000, when: at("2026-08-01T00:00:00Z") },
      { session: "mid", elapsedMs: 50_000, when: at("2026-08-05T00:00:00Z") },
      { session: "new", elapsedMs: 70_000, when: at("2026-08-06T10:00:00Z") },
    ];
    for (const r of rows) {
      await repo.insert({
        ...row(r.session, 1, { elapsedMs: r.elapsedMs }),
        createdAt: r.when,
      });
    }
    return repo;
  }

  it("since 이후 기록만 남는다", async () => {
    const repo = await seed();
    const recent = await repo.leaderboard("sido", "map", 10, 1, 1, at("2026-08-05T00:00:00Z"));
    expect(recent.map((e) => e.elapsedMs)).toEqual([50_000, 70_000]);
  });

  it("since가 없으면 전체 기간", async () => {
    const repo = await seed();
    const all = await repo.leaderboard("sido", "map", 10, 1, 1, null);
    expect(all).toHaveLength(3);
  });

  it("경계 시각의 기록은 포함된다", async () => {
    const repo = await seed();
    const board = await repo.leaderboard("sido", "map", 10, 1, 1, at("2026-08-01T00:00:00Z"));
    expect(board).toHaveLength(3);
  });

  it("기간 안에서도 순위 기준은 그대로다", async () => {
    const repo = await seed();
    const board = await repo.leaderboard("sido", "map", 10, 1, 1, at("2026-08-04T00:00:00Z"));
    expect(board.map((e) => e.elapsedMs)).toEqual([50_000, 70_000]);
  });
});

describe("지금 어디쯤인가", () => {
  it("나보다 나은 기록 수 + 1이 내 자리다", async () => {
    const repo = new MemoryScoreRepository();
    await repo.insert(row("s1", 1, { elapsedMs: 40_000 }));
    await repo.insert(row("s2", 1, { elapsedMs: 60_000 }));
    await repo.insert(row("s3", 1, { elapsedMs: 80_000 }));

    expect(
      await repo.standing("sido", "map", 1, 1, { completed: 17, hintsUsed: 0, elapsedMs: 50_000 }),
    ).toEqual({ better: 1, total: 3 });
    expect(
      await repo.standing("sido", "map", 1, 1, { completed: 17, hintsUsed: 0, elapsedMs: 30_000 }),
    ).toEqual({ better: 0, total: 3 });
  });

  it("비교할 수 없는 기록은 모수에서 뺀다", async () => {
    // 채점 규칙이나 코스 판번호가 다르면 같은 줄에 세울 수 없다.
    const repo = new MemoryScoreRepository();
    await repo.insert(row("s1", 1, { elapsedMs: 40_000 }));
    await repo.insert(row("s2", 2, { elapsedMs: 40_000 }));

    expect(
      await repo.standing("sido", "map", 1, 1, { completed: 17, hintsUsed: 0, elapsedMs: 99_000 }),
    ).toEqual({ better: 1, total: 1 });
  });

  it("아직 아무 기록도 없으면 0이다", async () => {
    const repo = new MemoryScoreRepository();
    expect(
      await repo.standing("sido", "map", 1, 1, { completed: 17, hintsUsed: 0, elapsedMs: 30_000 }),
    ).toEqual({ better: 0, total: 0 });
  });
});

describe("힌트가 순위를 가른다", () => {
  it("힌트를 덜 본 쪽이 느려도 위다", () => {
    const fast = { completed: 17, hintsUsed: 3, elapsedMs: 50_000 };
    const clean = { completed: 17, hintsUsed: 0, elapsedMs: 90_000 };
    expect(outranks(clean, fast)).toBe(true);
    expect(outranks(fast, clean)).toBe(false);
  });

  it("힌트가 같으면 빠른 쪽이 위다", () => {
    const a = { completed: 17, hintsUsed: 2, elapsedMs: 50_000 };
    const b = { completed: 17, hintsUsed: 2, elapsedMs: 90_000 };
    expect(outranks(a, b)).toBe(true);
  });

  it("완주 수가 먼저다 — 힌트 없이 덜 끝낸 판이 위로 오지 않는다", () => {
    const more = { completed: 17, hintsUsed: 5, elapsedMs: 90_000 };
    const fewer = { completed: 16, hintsUsed: 0, elapsedMs: 50_000 };
    expect(outranks(more, fewer)).toBe(true);
  });
});

describe("내린 기록", () => {
  /*
   * 순위표·등수·이웃 셋이 같은 모집단을 봐야 한다. 한 곳이라도 숨김을 안
   * 걸면 `상위 8%`라고 해 놓고 등록했을 때 다른 자리에 가 있게 된다.
   */
  it("숨기면 순위표에서도 등수에서도 빠진다", async () => {
    const repo = new MemoryScoreRepository();
    const base = {
      sessionId: "s1",
      courseId: "seoul",
      mode: "map" as const,
      deviceId: "dev-a",
      scoringVersion: 1,
      courseVersion: 1,
      cpm: 300,
      accuracy: 1,
      elapsedMs: 10_000,
      correctKeystrokes: 100,
      totalErrors: 0,
      completed: 25,
      total: 25,
      hintsUsed: 0,
    };
    await repo.insert({ ...base, sessionId: "s1", nickname: "정상" });
    await repo.insert({ ...base, sessionId: "s2", nickname: "내릴것", elapsedMs: 9_000 });

    const before = await repo.leaderboard("seoul", "map", 10, 1, 1);
    expect(before.map((r) => r.nickname)).toEqual(["내릴것", "정상"]);

    const hidden = await repo.hide({ deviceId: "dev-a" }, "도배", new Date());
    expect(hidden).toBe(2);

    expect(await repo.leaderboard("seoul", "map", 10, 1, 1)).toEqual([]);
    const standing = await repo.standing("seoul", "map", 1, 1, {
      completed: 25,
      elapsedMs: 10_000,
      hintsUsed: 0,
    });
    expect(standing.total).toBe(0);
  });

  it("이미 내린 것은 두 번 세지 않는다", async () => {
    // 사유와 시각이 처음 내린 그때의 것으로 남아야 한다.
    const repo = new MemoryScoreRepository();
    await repo.insert({
      sessionId: "s1",
      courseId: "seoul",
      mode: "map",
      nickname: "x",
      deviceId: "dev-b",
      scoringVersion: 1,
      courseVersion: 1,
      cpm: 1,
      accuracy: 1,
      elapsedMs: 1,
      correctKeystrokes: 1,
      totalErrors: 0,
      completed: 1,
      total: 1,
      hintsUsed: 0,
    });
    expect(await repo.hide({ deviceId: "dev-b" }, "욕설", new Date())).toBe(1);
    expect(await repo.hide({ deviceId: "dev-b" }, "다시", new Date())).toBe(0);
  });
});

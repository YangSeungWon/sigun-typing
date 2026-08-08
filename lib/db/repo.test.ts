import { describe, expect, it } from "vitest";
import { MemoryScoreRepository } from "./repo";
import type { NewScoreRow } from "./schema";

const base: Omit<NewScoreRow, "sessionId" | "scoringVersion" | "courseVersion"> = {
  courseId: "sido",
  mode: "map",
  nickname: "테스터",
  deviceId: "dev-1",
  cpm: 300,
  accuracy: 1,
  elapsedMs: 10_000,
  correctKeystrokes: 50,
  totalErrors: 0,
  completed: 17,
  total: 17,
};

function row(sessionId: string, scoringVersion: number, cpm: number): NewScoreRow {
  return { ...base, sessionId, scoringVersion, courseVersion: 1, cpm };
}

describe("채점 버전", () => {
  it("순위표는 다른 버전의 기록을 섞지 않는다", async () => {
    const repo = new MemoryScoreRepository();
    await repo.insert(row("s1", 1, 500));
    await repo.insert(row("s2", 2, 900));

    const v1 = await repo.leaderboard("sido", "map", 10, 1, 1);
    expect(v1).toHaveLength(1);
    expect(v1[0].cpm).toBe(500);

    const v2 = await repo.leaderboard("sido", "map", 10, 2, 1);
    expect(v2).toHaveLength(1);
    expect(v2[0].cpm).toBe(900);
  });

  it("같은 버전 안에서는 타수순으로 정렬된다", async () => {
    const repo = new MemoryScoreRepository();
    await repo.insert(row("a", 1, 300));
    await repo.insert(row("b", 1, 700));
    await repo.insert(row("c", 1, 500));
    const board = await repo.leaderboard("sido", "map", 10, 1, 1);
    expect(board.map((e) => e.cpm)).toEqual([700, 500, 300]);
  });

  it("같은 세션은 한 번만 저장된다", async () => {
    const repo = new MemoryScoreRepository();
    expect(await repo.insert(row("dup", 1, 400))).toBe(true);
    expect(await repo.insert(row("dup", 1, 900))).toBe(false);
    expect(await repo.leaderboard("sido", "map", 10, 1, 1)).toHaveLength(1);
  });
});

describe("기간 필터", () => {
  const at = (iso: string) => new Date(iso);

  async function seed() {
    const repo = new MemoryScoreRepository();
    // MemoryScoreRepository는 createdAt을 스스로 찍으므로 직접 넣어 준다.
    const rows = [
      { session: "old", cpm: 900, when: at("2026-08-01T00:00:00Z") },
      { session: "mid", cpm: 700, when: at("2026-08-05T00:00:00Z") },
      { session: "new", cpm: 500, when: at("2026-08-06T10:00:00Z") },
    ];
    for (const r of rows) {
      await repo.insert({ ...row(r.session, 1, r.cpm), createdAt: r.when });
    }
    return repo;
  }

  it("since 이후 기록만 남는다", async () => {
    const repo = await seed();
    const recent = await repo.leaderboard("sido", "map", 10, 1, 1, at("2026-08-05T00:00:00Z"));
    expect(recent.map((e) => e.cpm)).toEqual([700, 500]);
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

  it("기간 안에서도 타수순 정렬이 유지된다", async () => {
    const repo = await seed();
    const board = await repo.leaderboard("sido", "map", 10, 1, 1, at("2026-08-04T00:00:00Z"));
    expect(board.map((e) => e.cpm)).toEqual([700, 500]);
  });
});

describe("지금 어디쯤인가", () => {
  it("나보다 나은 기록 수 + 1이 내 자리다", async () => {
    const repo = new MemoryScoreRepository();
    await repo.insert(row("s1", 1, 400));
    await repo.insert(row("s2", 1, 300));
    await repo.insert(row("s3", 1, 200));

    expect(await repo.standing("sido", "map", 1, 1, 350)).toEqual({
      better: 1,
      total: 3,
    });
    expect(await repo.standing("sido", "map", 1, 1, 500)).toEqual({
      better: 0,
      total: 3,
    });
  });

  it("비교할 수 없는 기록은 모수에서 뺀다", async () => {
    // 채점 규칙이나 코스 판번호가 다르면 같은 줄에 세울 수 없다.
    const repo = new MemoryScoreRepository();
    await repo.insert(row("s1", 1, 400));
    await repo.insert(row("s2", 2, 400));

    expect(await repo.standing("sido", "map", 1, 1, 100)).toEqual({
      better: 1,
      total: 1,
    });
  });

  it("아직 아무 기록도 없으면 0이다", async () => {
    const repo = new MemoryScoreRepository();
    expect(await repo.standing("sido", "map", 1, 1, 300)).toEqual({
      better: 0,
      total: 0,
    });
  });
});

import { describe, expect, it } from "vitest";
import type { ItemResult } from "../game/types";
import {
  applyRun,
  GRADUATE_STREAK,
  isMiss,
  sortByPriority,
  type MistakeRecord,
} from "./mistakes";

function result(over: Partial<ItemResult> = {}): ItemResult {
  return {
    id: "41110",
    answer: "수원",
    elapsedMs: 2_000,
    keystrokes: 6,
    errors: 0,
    attempts: 1,
    skipped: false,
    hinted: false,
    ...over,
  };
}

function record(over: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    code: "41110",
    name: "수원",
    misses: 1,
    cleanStreak: 0,
    lastMissedAt: 1_000,
    ...over,
  };
}

describe("틀렸다의 정의", () => {
  it("깨끗하게 맞히면 오답이 아니다", () => {
    expect(isMiss(result())).toBe(false);
  });

  it("오타가 있으면 오답이다", () => {
    expect(isMiss(result({ errors: 1 }))).toBe(true);
  });

  it("건너뛰면 오답이다", () => {
    expect(isMiss(result({ skipped: true }))).toBe(true);
  });

  it("맞혔더라도 힌트를 봤으면 오답이다", () => {
    // 이걸 빼면 힌트로 넘긴 지역이 영영 오답노트에 들어오지 않는다.
    expect(isMiss(result({ hinted: true }))).toBe(true);
  });
});

describe("오답노트 갱신", () => {
  it("처음 틀리면 새로 들어온다", () => {
    const next = applyRun([], [result({ errors: 1 })], 5_000);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ code: "41110", name: "수원", misses: 1 });
    expect(next[0].lastMissedAt).toBe(5_000);
  });

  it("또 틀리면 횟수가 쌓인다", () => {
    const next = applyRun([record({ misses: 2 })], [result({ errors: 1 })], 9_000);
    expect(next[0].misses).toBe(3);
    expect(next[0].lastMissedAt).toBe(9_000);
  });

  it("맞히면 연속 정답이 쌓이지만 바로 빠지지는 않는다", () => {
    const next = applyRun([record({ misses: 3 })], [result()], 9_000);
    expect(next).toHaveLength(1);
    expect(next[0].cleanStreak).toBe(1);
    expect(next[0].misses, "틀린 이력은 남는다").toBe(3);
  });

  it("연속으로 깨끗하게 맞히면 오답노트에서 빠진다", () => {
    let notebook = [record({ misses: 3 })];
    for (let i = 0; i < GRADUATE_STREAK; i++) {
      notebook = applyRun(notebook, [result()], 9_000);
    }
    expect(notebook).toHaveLength(0);
  });

  it("도중에 다시 틀리면 연속 정답이 초기화된다", () => {
    let notebook = [record({ misses: 1 })];
    notebook = applyRun(notebook, [result()], 2_000);
    expect(notebook[0].cleanStreak).toBe(1);
    notebook = applyRun(notebook, [result({ errors: 1 })], 3_000);
    expect(notebook[0].cleanStreak).toBe(0);
    expect(notebook[0].misses).toBe(2);
  });

  it("힌트로 넘긴 곳은 연속 정답으로 쳐 주지 않는다", () => {
    const notebook = applyRun([record()], [result({ hinted: true })], 3_000);
    expect(notebook[0].cleanStreak).toBe(0);
    expect(notebook[0].misses).toBe(2);
  });

  it("노트에 없던 곳을 맞혀도 기록하지 않는다", () => {
    expect(applyRun([], [result()], 1_000)).toHaveLength(0);
  });

  it("한 판의 여러 항목을 함께 반영한다", () => {
    const next = applyRun(
      [],
      [
        result({ id: "41110", answer: "수원", errors: 1 }),
        result({ id: "41130", answer: "성남" }),
        result({ id: "41190", answer: "부천", skipped: true }),
      ],
      7_000,
    );
    expect(next.map((r) => r.name).sort()).toEqual(["부천", "수원"]);
  });
});

describe("무엇으로 착각했는지", () => {
  const PEERS = [{ name: "수원" }, { name: "성남" }, { name: "안양" }];

  it("같은 코스의 다른 지역을 냈으면 상대를 세어 둔다", () => {
    const next = applyRun(
      [],
      [result({ errors: 1, wrongAnswers: ["성남"] })],
      5_000,
      PEERS,
    );
    expect(next[0].confusedWith).toEqual({ 성남: 1 });
  });

  it("같은 상대를 또 틀리면 는다", () => {
    let notebook = applyRun([], [result({ errors: 1, wrongAnswers: ["성남"] })], 1_000, PEERS);
    notebook = applyRun(notebook, [result({ errors: 1, wrongAnswers: ["성남"] })], 2_000, PEERS);
    expect(notebook[0].confusedWith).toEqual({ 성남: 2 });
  });

  it("코스에 없는 답은 쌓지 않는다", () => {
    const next = applyRun(
      [],
      [result({ errors: 1, wrongAnswers: ["춘천"] })],
      5_000,
      PEERS,
    );
    expect(next[0].confusedWith).toBeUndefined();
  });

  it("목표에서 자모 한 개 미끄러진 것은 오타라 쌓지 않는다", () => {
    const next = applyRun(
      [],
      [result({ errors: 1, wrongAnswers: ["수언"] })],
      5_000,
      PEERS,
    );
    expect(next[0].confusedWith).toBeUndefined();
  });

  it("상대 목록 없이 부르면 아무것도 쌓지 않는다", () => {
    // 기본값이 그렇다 — 모르면 안 적는 쪽이 기본이어야 한다.
    const next = applyRun([], [result({ errors: 1, wrongAnswers: ["성남"] })], 5_000);
    expect(next[0].confusedWith).toBeUndefined();
  });

  it("혼동 기록이 없던 옛 오답을 갱신해도 깨지지 않는다", () => {
    const old = record({ misses: 3 });
    expect(old.confusedWith).toBeUndefined();

    const next = applyRun([old], [result({ errors: 1, wrongAnswers: ["안양"] })], 9_000, PEERS);
    expect(next[0]).toMatchObject({ misses: 4, confusedWith: { 안양: 1 } });
  });

  it("맞힌 항목의 오답 이력은 세지 않는다", () => {
    /*
     * 한 판에서 두 번 틀리고 세 번째에 맞혔다면 그건 이미 `errors`가 세고 있다.
     * 여기서 또 세면 한 항목에서 같은 착각이 여러 번 쌓인다.
     */
    const next = applyRun(
      [record({ misses: 1, confusedWith: { 성남: 1 } })],
      [result({ wrongAnswers: ["성남"] })],
      9_000,
      PEERS,
    );
    expect(next[0].confusedWith).toEqual({ 성남: 1 });
  });
});

describe("우선순위", () => {
  it("자주 틀린 것이 먼저 온다", () => {
    const sorted = sortByPriority([
      record({ code: "a", name: "가", misses: 1 }),
      record({ code: "b", name: "나", misses: 5 }),
      record({ code: "c", name: "다", misses: 3 }),
    ]);
    expect(sorted.map((r) => r.name)).toEqual(["나", "다", "가"]);
  });

  it("횟수가 같으면 최근에 틀린 것이 먼저 온다", () => {
    const sorted = sortByPriority([
      record({ code: "a", name: "가", misses: 2, lastMissedAt: 100 }),
      record({ code: "b", name: "나", misses: 2, lastMissedAt: 900 }),
    ]);
    expect(sorted.map((r) => r.name)).toEqual(["나", "가"]);
  });

  it("갱신 결과는 이미 정렬되어 있다", () => {
    const next = applyRun(
      [record({ code: "a", name: "가", misses: 1 })],
      [
        result({ id: "b", answer: "나", errors: 1 }),
        result({ id: "b", answer: "나", errors: 1 }),
      ],
      5_000,
    );
    expect(next[0].name).toBe("나");
  });
});

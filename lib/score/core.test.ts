import { describe, expect, it } from "vitest";
import { computeScore } from "./core";

describe("점수 규칙", () => {
  it("한 타도 안 쳤으면 정확도는 100%다", () => {
    // 0%로 두면 시작만 하고 나간 판이 순위표에 0%로 남는다.
    const s = computeScore({
      correctKeystrokes: 0,
      typedKeystrokes: 0,
      elapsedMs: 5_000,
      totalErrors: 0,
      completed: 0,
      total: 17,
      hintsUsed: 0,
    });
    expect(s.accuracy).toBe(1);
    expect(s.cpm).toBe(0);
  });

  it("정확도는 100%를 넘지 않는다", () => {
    const s = computeScore({
      correctKeystrokes: 50,
      typedKeystrokes: 40,
      elapsedMs: 10_000,
      totalErrors: 0,
      completed: 5,
      total: 17,
      hintsUsed: 0,
    });
    expect(s.accuracy).toBe(1);
  });

  it("음수 타수는 0으로 본다", () => {
    // 조작된 제출이 여기까지 올 수 있다. 음수가 통과하면 cpm이 음수가 된다.
    const s = computeScore({
      correctKeystrokes: -100,
      typedKeystrokes: -1,
      elapsedMs: 1_000,
      totalErrors: 0,
      completed: 0,
      total: 1,
      hintsUsed: 0,
    });
    expect(s.correctKeystrokes).toBe(0);
    expect(s.cpm).toBe(0);
  });
});

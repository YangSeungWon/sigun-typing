import { describe, expect, it } from "vitest";
import type { Score } from "../game/types";
import {
  isBetter,
  loadPersonalBest,
  savePersonalBest,
  toRecord,
} from "./personalBest";
import { SCORING_VERSION } from "./version";

function score(over: Partial<Score> = {}): Score {
  return {
    cpm: 300,
    accuracy: 1,
    elapsedMs: 60_000,
    correctKeystrokes: 300,
    totalErrors: 0,
    completed: 31,
    total: 31,
    hintsUsed: 0,
    firstTry: 0,
    answerRate: 1,
    ...over,
  };
}

const best = toRecord("gyeonggi", "map", score(), 1_000);

describe("개인 최고 기록 비교", () => {
  it("더 빠르면 갱신된다", () => {
    expect(isBetter(score({ elapsedMs: 55_000 }), best)).toBe(true);
  });

  it("더 느리면 갱신되지 않는다", () => {
    expect(isBetter(score({ elapsedMs: 65_000 }), best)).toBe(false);
  });

  it("같은 기록은 갱신이 아니다", () => {
    expect(isBetter(score(), best)).toBe(false);
  });

  it("완주 수가 시간보다 우선한다 — 건너뛰고 빨리 끝낸 판이 이기면 안 된다", () => {
    const skippedButFast = score({ completed: 20, elapsedMs: 10_000 });
    expect(isBetter(skippedButFast, best)).toBe(false);
  });

  it("더 많이 끝냈으면 더 오래 걸려도 갱신된다 — 타임어택의 기준", () => {
    const partial = toRecord("sido", "learn", score({ completed: 12 }), 0);
    const more = score({ completed: 15, elapsedMs: 70_000 });
    expect(isBetter(more, partial)).toBe(true);
  });

  it("완주 수와 시간이 같으면 정확도로 가른다", () => {
    expect(isBetter(score({ accuracy: 0.99 }), best)).toBe(false);
    const lower = toRecord("gyeonggi", "map", score({ accuracy: 0.9 }), 0);
    expect(isBetter(score({ accuracy: 0.95 }), lower)).toBe(true);
  });

  it("기록에 채점 버전이 함께 남는다", () => {
    expect(best.scoringVersion).toBe(SCORING_VERSION);
  });
});

/** node 환경에는 localStorage가 없다. 키 분리만 확인하면 되므로 최소한만 흉내 낸다. */
function stubStorage() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    clear: () => map.clear(),
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: store,
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  return map;
}

describe("기록 격리", () => {
  it("코스가 다르면 최고 기록이 섞이지 않는다", () => {
    const map = stubStorage();
    savePersonalBest("seoul", "map", score({ elapsedMs: 30_000 }), 0, 1);
    savePersonalBest("gyeonggi", "map", score({ elapsedMs: 90_000 }), 0, 1);

    expect(loadPersonalBest("seoul", "map", 1)!.elapsedMs).toBe(30_000);
    expect(loadPersonalBest("gyeonggi", "map", 1)!.elapsedMs).toBe(90_000);
    expect(map.size).toBe(2);
  });

  it("모드가 다르면 최고 기록이 섞이지 않는다", () => {
    stubStorage();
    savePersonalBest("seoul", "map", score({ elapsedMs: 30_000 }), 0, 1);
    savePersonalBest("seoul", "learn", score({ elapsedMs: 20_000 }), 0, 1);
    expect(loadPersonalBest("seoul", "map", 1)!.elapsedMs).toBe(30_000);
    expect(loadPersonalBest("seoul", "learn", 1)!.elapsedMs).toBe(20_000);
  });

  it("채점 버전이 다른 기록은 없는 것으로 본다", () => {
    const map = stubStorage();
    savePersonalBest("seoul", "map", score(), 0, 1);
    // 저장된 레코드의 버전을 손으로 바꾸면 비교 대상에서 빠져야 한다.
    const [key] = [...map.keys()];
    map.set(key, JSON.stringify({ ...JSON.parse(map.get(key)!), scoringVersion: 999 }));
    expect(loadPersonalBest("seoul", "map", 1)).toBeNull();
  });

  it("아무것도 끝내지 못한 판은 기록으로 남기지 않는다", () => {
    const map = stubStorage();
    savePersonalBest("seoul", "map", score({ completed: 0 }), 0, 1);
    expect(map.size).toBe(0);
  });
});

describe("코스 판번호별 격리", () => {
  it("코스 내용이 바뀌면 옛 기록과 비교하지 않는다", () => {
    stubStorage();
    savePersonalBest("incheon", "map", score({ elapsedMs: 30_000 }), 0, 1);
    // 인천처럼 행정구역이 바뀌면 판번호가 오르고, 그때부터는 새 기록만 본다.
    expect(loadPersonalBest("incheon", "map", 2)).toBeNull();
    expect(loadPersonalBest("incheon", "map", 1)!.elapsedMs).toBe(30_000);
  });

  it("키에 세 축이 모두 들어간다", () => {
    const map = stubStorage();
    savePersonalBest("seoul", "learn", score(), 0, 3);
    const [key] = [...map.keys()];
    expect(key).toContain(`s${SCORING_VERSION}`);
    expect(key).toContain("c3");
    expect(key).toContain("learn");
    expect(key).toContain("seoul");
  });
});

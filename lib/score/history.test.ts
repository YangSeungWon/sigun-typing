import { beforeEach, describe, expect, it, vi } from "vitest";
import { addRun, KEEP, loadRuns, runsOf, type RunRecord } from "./history";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
}

beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));

function run(over: Partial<RunRecord> = {}): RunRecord {
  return {
    courseId: "seoul",
    mode: "map",
    elapsedMs: 41_000,
    completed: 25,
    total: 25,
    hintsUsed: 0,
    at: 1_000,
    ...over,
  };
}

describe("지나온 판", () => {
  it("쌓인 순서를 지킨다", () => {
    addRun(run({ at: 1 }));
    addRun(run({ at: 2 }));
    expect(loadRuns().map((r) => r.at)).toEqual([1, 2]);
  });

  it("코스·모드마다 따로 자른다", () => {
    /*
     * 전체를 한 통에 넣고 자르면 전국을 한 판 돌 때 서울 기록이 밀려 나간다 —
     * 코스마다 하는 빈도가 다르다.
     */
    for (let i = 0; i < KEEP + 5; i++) addRun(run({ courseId: "nationwide", at: i }));
    addRun(run({ courseId: "seoul", at: 999 }));

    const all = loadRuns();
    expect(runsOf(all, "nationwide", "map")).toHaveLength(KEEP);
    expect(runsOf(all, "seoul", "map")).toHaveLength(1);
  });

  it("자를 때 오래된 것부터 버린다", () => {
    for (let i = 0; i < KEEP + 3; i++) addRun(run({ at: i }));
    const kept = runsOf(loadRuns(), "seoul", "map");
    expect(kept[0].at).toBe(3);
    expect(kept.at(-1)!.at).toBe(KEEP + 2);
  });

  it("같은 코스라도 모드가 다르면 다른 곡선이다", () => {
    // `이름 보고 익히기`는 답이 화면에 있어 시간이 다른 종류의 값이다.
    addRun(run({ mode: "map", at: 1 }));
    addRun(run({ mode: "learn", at: 2 }));
    const all = loadRuns();
    expect(runsOf(all, "seoul", "map")).toHaveLength(1);
    expect(runsOf(all, "seoul", "learn")).toHaveLength(1);
  });

  it("망가진 값은 버리고 나머지를 읽는다", () => {
    localStorage.setItem(
      "sigun:runs:v1",
      JSON.stringify([run(), { courseId: "seoul" }, "쓰레기"]),
    );
    expect(loadRuns()).toHaveLength(1);
  });

  it("아무것도 없으면 빈 목록이다", () => {
    expect(loadRuns()).toEqual([]);
  });
});

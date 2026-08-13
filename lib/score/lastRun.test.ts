import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLastRun, saveLastRun } from "./lastRun";

function fakeStorage(seed: Record<string, string> = {}, overrides: Partial<Storage> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    ...overrides,
  } as Storage;
}

afterEach(() => vi.unstubAllGlobals());

describe("마지막으로 끝낸 판", () => {
  it("쓰고 읽는다", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    expect(saveLastRun("gyeonggi", "map", 7_000)).toBe(true);
    expect(loadLastRun()).toEqual({ courseId: "gyeonggi", mode: "map", at: 7_000 });
  });

  it("한 판을 더 하면 덮어쓴다", () => {
    // 코스별로 쌓지 않는다 — 묻는 것이 "직전에 뭘 했나" 하나뿐이다.
    vi.stubGlobal("localStorage", fakeStorage());
    saveLastRun("seoul", "map", 1_000);
    saveLastRun("jeju", "learn", 2_000);
    expect(loadLastRun()).toMatchObject({ courseId: "jeju", mode: "learn" });
  });

  it("남긴 적이 없으면 없다", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    expect(loadLastRun()).toBeNull();
  });

  it("손으로 고쳐 놓은 값은 없는 것으로 본다", () => {
    vi.stubGlobal("localStorage", fakeStorage({
      "sigun:last:v1": JSON.stringify({ courseId: "", mode: "map", at: 1 }),
    }));
    expect(loadLastRun()).toBeNull();

    vi.stubGlobal("localStorage", fakeStorage({ "sigun:last:v1": "{{{" }));
    expect(loadLastRun()).toBeNull();
  });

  it("저장이 막혀도 던지지 않는다", () => {
    // 사생활 보호 모드. 기록을 못 남길 뿐 게임은 그대로 돌아가야 한다.
    vi.stubGlobal("localStorage", fakeStorage({}, {
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    }));
    expect(saveLastRun("seoul", "map", 1_000)).toBe(false);
  });
});

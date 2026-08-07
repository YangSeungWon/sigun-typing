import { afterEach, describe, expect, it, vi } from "vitest";
import { readJson, readText, remove, writeJson, writeText } from "./storage";

/** 브라우저 없이 저장소 동작만 확인하기 위한 최소 구현. */
function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>();
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

function install(storage: Storage | undefined) {
  vi.stubGlobal("localStorage", storage);
}

afterEach(() => vi.unstubAllGlobals());

describe("기기 저장소", () => {
  it("쓰고 읽는다", () => {
    install(fakeStorage());
    expect(writeJson("sigun:t", { a: 1 })).toBe(true);
    expect(readJson("sigun:t", (raw) => raw as { a: number })).toEqual({ a: 1 });
  });

  it("저장소가 없으면 조용히 없는 값처럼 군다", () => {
    // 서버 렌더가 이 경로를 탄다. 여기서 터지면 페이지 전체가 안 뜬다.
    install(undefined);
    expect(readText("sigun:t")).toBeNull();
    expect(writeText("sigun:t", "x")).toBe(false);
    expect(() => remove("sigun:t")).not.toThrow();
  });

  it("쓰기가 막혀도 예외를 밖으로 내지 않는다", () => {
    // 사생활 보호 모드나 용량 초과. 기록을 못 남길 뿐 게임은 계속돼야 한다.
    install(
      fakeStorage({
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      }),
    );
    expect(writeJson("sigun:t", { a: 1 })).toBe(false);
  });

  it("깨진 JSON은 없는 값으로 본다", () => {
    const s = fakeStorage();
    s.setItem("sigun:t", "{보나마나 깨진");
    install(s);
    expect(readJson("sigun:t", (raw) => raw)).toBeNull();
  });

  it("모양이 어긋난 값은 검사에서 걸러낸다", () => {
    // localStorage는 사용자가 직접 고칠 수 있는 입력이다.
    const s = fakeStorage();
    s.setItem("sigun:t", JSON.stringify({ cpm: "빠름" }));
    install(s);
    const value = readJson("sigun:t", (raw) =>
      typeof (raw as { cpm?: unknown })?.cpm === "number" ? raw : null,
    );
    expect(value).toBeNull();
  });
});

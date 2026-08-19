import { beforeEach, describe, expect, it, vi } from "vitest";
import { aliveOn, loadStreak, recordDay } from "./streak";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
}

beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));

describe("며칠째 이어서 오고 있는가", () => {
  it("이어서 오면 는다", () => {
    recordDay(0, true);
    recordDay(1, true);
    expect(recordDay(2, true).current).toBe(3);
  });

  it("못 맞혀도 끊기지 않는다", () => {
    /*
     * 229곳 중 하나라 낯선 군이 나오는 날이 반드시 있다. 그런 날 하나가
     * 두 달치를 지우면 그 사람은 다시 안 온다.
     */
    recordDay(0, true);
    expect(recordDay(1, false).current).toBe(2);
  });

  it("하루 걸러 오면 끊긴다", () => {
    recordDay(0, true);
    expect(recordDay(2, true).current).toBe(1);
  });

  it("가장 길었던 연속은 남는다", () => {
    recordDay(0, true);
    recordDay(1, true);
    recordDay(5, true);
    expect(loadStreak()).toMatchObject({ current: 1, best: 2 });
  });

  it("같은 날 두 번 불러도 한 번만 센다", () => {
    // 화면이 다시 그려질 때마다 숫자가 오르면 그건 기록이 아니다.
    recordDay(3, true);
    recordDay(3, true);
    expect(loadStreak()).toMatchObject({ current: 1, played: 1 });
  });

  it("맞힌 날은 따로 센다", () => {
    recordDay(0, true);
    recordDay(1, false);
    recordDay(2, true);
    expect(loadStreak()).toMatchObject({ played: 3, solved: 2 });
  });
});

describe("오늘 기준으로 살아 있는가", () => {
  it("오늘 풀었으면 살아 있다", () => {
    const s = recordDay(4, true);
    expect(aliveOn(s, 4)).toBe(1);
  });

  it("어제까지 풀었으면 아직 살아 있다", () => {
    // 오늘 아직 안 푼 사람에게 `연속 3일`이 보여야 오늘 풀 이유가 된다.
    recordDay(3, true);
    const s = recordDay(4, true);
    expect(aliveOn(s, 5)).toBe(2);
  });

  it("이틀 쉬었으면 끊긴 것이다", () => {
    const s = recordDay(4, true);
    expect(aliveOn(s, 6)).toBe(0);
  });
});

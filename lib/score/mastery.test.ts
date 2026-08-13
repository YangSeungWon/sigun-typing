import { afterEach, describe, expect, it, vi } from "vitest";
import { readAllMastery, readCourseMastery } from "./mastery";
import type { PersonalBest } from "./personalBest";
import type { MistakeRecord } from "./mistakes";
import { SCORING_VERSION } from "./version";

/** 브라우저 없이 저장소 동작만 확인하기 위한 최소 구현. lib/storage.test.ts와 같은 수법. */
function fakeStorage(seed: Record<string, unknown> = {}): Storage {
  const map = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

const SEOUL = { id: "seoul", version: 2, total: 25 };

function best(over: Partial<PersonalBest> = {}): PersonalBest {
  return {
    courseId: "seoul",
    mode: "map",
    cpm: 200,
    accuracy: 90,
    elapsedMs: 60_000,
    completed: 25,
    total: 25,
    hintsUsed: 0,
    // 이 값이 SCORING_VERSION과 다르면 loadPersonalBest가 없는 것으로 본다.
    scoringVersion: SCORING_VERSION,
    achievedAt: 1_000,
    ...over,
  };
}

function mistake(code: string): MistakeRecord {
  return { code, name: code, misses: 1, cleanStreak: 0, lastMissedAt: 1_000 };
}

afterEach(() => vi.unstubAllGlobals());

describe("코스별 아는 곳", () => {
  it("해 본 적이 없으면 아무것도 아는 것이 아니다", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    expect(readCourseMastery(SEOUL)).toMatchObject({ played: false, known: 0 });
  });

  it("오답만 남아 있어도 해 본 것으로 본다", () => {
    // 기록을 남기지 못한 판(한 곳도 못 끝낸 판)도 오답은 남긴다.
    vi.stubGlobal("localStorage", fakeStorage({
      "sigun:miss:v1:seoul": [mistake("11110"), mistake("11140")],
    }));
    expect(readCourseMastery(SEOUL)).toMatchObject({ played: true, known: 23 });
  });

  it("개인 기록이 있으면 오답이 없어도 해 본 것이다", () => {
    vi.stubGlobal("localStorage", fakeStorage({ [`sigun:pb:s${SCORING_VERSION}:c2:map:seoul`]: best() }));
    expect(readCourseMastery(SEOUL)).toMatchObject({ played: true, known: 25 });
  });

  it("연습 모드만 해도 해 본 것이다", () => {
    vi.stubGlobal("localStorage", fakeStorage({
      [`sigun:pb:s${SCORING_VERSION}:c2:learn:seoul`]: best({ mode: "learn" }),
    }));
    expect(readCourseMastery(SEOUL).played).toBe(true);
  });

  it("판번호가 다른 옛 기록은 해 본 것으로 세지 않는다", () => {
    vi.stubGlobal("localStorage", fakeStorage({ [`sigun:pb:s${SCORING_VERSION}:c1:map:seoul`]: best() }));
    expect(readCourseMastery(SEOUL).played).toBe(false);
  });

  it("아는 곳이 음수가 되지 않는다", () => {
    // 옛 판번호의 찌꺼기가 섞이면 오답이 코스보다 길어질 수 있다.
    const many = Array.from({ length: 30 }, (_, i) => mistake(String(i)));
    vi.stubGlobal("localStorage", fakeStorage({ "sigun:miss:v1:seoul": many }));
    expect(readCourseMastery(SEOUL).known).toBe(0);
  });
});

describe("여러 코스 한꺼번에", () => {
  it("코스마다 하나씩, 안 해 본 것도 자리를 지킨다", () => {
    vi.stubGlobal("localStorage", fakeStorage({
      "sigun:miss:v1:seoul": [mistake("11110")],
    }));
    const all = readAllMastery([SEOUL, { id: "jeju", version: 1, total: 2 }]);
    expect(all.get("seoul")).toMatchObject({ played: true, known: 24 });
    expect(all.get("jeju")).toMatchObject({ played: false, known: 0 });
  });
});

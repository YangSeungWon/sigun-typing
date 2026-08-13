import { afterEach, describe, expect, it, vi } from "vitest";
import { COURSES, getCourse } from "@/data/courses";
import { splitNotebooks } from "./notebooks";
import { saveRun, loadMistakes } from "./mistakes";
import { loadPlayed, markPlayed } from "./played";
import { readAllMastery } from "./mastery";
import type { ItemResult } from "../game/types";

/**
 * 전국 시군구 코스를 한 판 돌면 무슨 일이 일어나는가.
 *
 * `RunRecorder`가 판이 끝났을 때 하는 일을 그대로 따라 한다 — 노트를 나누고,
 * 나뉜 대로 저장하고, 끝낸 코스를 표시한다. 컴포넌트는 effect라 서버 렌더로는
 * 확인할 수 없고, 정작 확인하고 싶은 것은 화면이 아니라 **기기에 무엇이
 * 남는가**이므로 그 함수들을 직접 부른다.
 */
function fakeStorage(): Storage {
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
  } as Storage;
}

const nationwide = getCourse("nationwide")!;

/** 판 하나. 지정한 코드들만 틀리고 나머지는 깨끗하게 맞힌 것으로 본다. */
function run(missed: Set<string>): ItemResult[] {
  return nationwide.regions.map((r) => ({
    id: r.code,
    answer: r.name,
    elapsedMs: 1_000,
    keystrokes: 5,
    errors: missed.has(r.code) ? 1 : 0,
    attempts: 1,
    skipped: false,
    hinted: false,
  }));
}

/** RunRecorder가 하는 일. */
function record(results: ItemResult[]) {
  const books = splitNotebooks(results, nationwide, COURSES);
  for (const b of books) saveRun(b.courseId, b.results, 1_000, b.peers);
  markPlayed([nationwide.id, ...books.map((b) => b.courseId)]);
  return books;
}

afterEach(() => vi.unstubAllGlobals());

describe("전국 시군구 한 판", () => {
  it("오답이 지역이 원래 속한 시도 코스로 들어간다", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    // 도봉구(서울)와 해운대구(부산)를 틀렸다.
    record(run(new Set(["11320", "26350"])));

    expect(loadMistakes("seoul").map((r) => r.name)).toEqual(["도봉구"]);
    expect(loadMistakes("busan").map((r) => r.name)).toEqual(["해운대구"]);
    // 전국 코스 자기 노트에는 아무것도 쌓이지 않는다.
    expect(loadMistakes("nationwide")).toEqual([]);
  });

  it("어느 코스로 만났든 같은 곳은 한 노트에 쌓인다", () => {
    /*
     * 이 배관의 존재 이유. 나누지 않으면 서울 코스에서 틀린 도봉구와 전국에서
     * 틀린 도봉구가 따로 놀아, 헷갈리는 곳 카드에 같은 짝이 두 번 뜬다.
     */
    vi.stubGlobal("localStorage", fakeStorage());
    const seoul = getCourse("seoul")!;
    saveRun(
      "seoul",
      [{ ...run(new Set())[0], id: "11320", answer: "도봉구", errors: 1 }],
      1_000,
      seoul.regions,
    );
    record(run(new Set(["11320"])));

    const stuck = loadMistakes("seoul");
    expect(stuck).toHaveLength(1);
    expect(stuck[0]).toMatchObject({ name: "도봉구", misses: 2 });
  });

  it("한 곳도 안 틀려도 시도 코스들이 해 본 것으로 남는다", () => {
    /*
     * 오답이 없으면 노트에 아무것도 안 남고 개인 기록은 전국 코스 이름으로
     * 저장된다. 그것만 보면 부산을 방금 다 맞혔는데도 안 해 본 것이 된다.
     */
    vi.stubGlobal("localStorage", fakeStorage());
    record(run(new Set()));

    const played = loadPlayed();
    expect(played.has("nationwide")).toBe(true);
    expect(played.has("busan")).toBe(true);
    expect(played.has("seoul")).toBe(true);
    // 시군 코스가 없는 세종은 애초에 코스가 없다.
    expect(played.has("sejong")).toBe(false);
  });

  it("정복도가 두 번 세지 않는다", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    record(run(new Set()));

    const refs = COURSES.map((c) => ({
      id: c.id,
      version: c.version,
      total: c.regions.length,
    }));
    const mastery = readAllMastery(refs);

    // 시군 코스 열여섯이 전부 채워진다.
    const sigungu = COURSES.filter(
      (c) => c.geo?.file === "municipalities" && !c.overlapping,
    );
    for (const c of sigungu) {
      expect(mastery.get(c.id), c.id).toMatchObject({
        played: true,
        known: c.regions.length,
      });
    }

    /*
     * 겹치는 코스를 빼고 더하면 228이다. 빼지 않으면 456이 되고, 245분의
     * 456이라는 정복도가 나온다.
     */
    const counted = COURSES.filter((c) => !c.overlapping)
      .reduce((sum, c) => sum + (mastery.get(c.id)?.known ?? 0), 0);
    expect(counted).toBe(228);
  });
});

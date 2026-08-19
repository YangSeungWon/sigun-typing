import { vi } from "vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { loadQuiz, saveQuiz } from "./store";
import { MAX_TRIES, type QuizState } from "./quiz";

const KEY = "sigun:daily:v1";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
});

const played: QuizState = {
  day: 5,
  sidoPicks: ["41"],
  guesses: [{ name: "평택시", closeness: "hit" }],
  solved: true,
};

describe("오늘 푼 판", () => {
  it("같은 날이면 이어서 본다", () => {
    saveQuiz(played);
    expect(loadQuiz(5)).toEqual(played);
  });

  it("날이 바뀌면 새 판이다", () => {
    // 어제 판을 들고 있어도 쓸 데가 없다.
    saveQuiz(played);
    expect(loadQuiz(6).guesses).toEqual([]);
    expect(loadQuiz(6).day).toBe(6);
  });

  it("아무것도 없으면 새 판이다", () => {
    expect(loadQuiz(1)).toEqual({ day: 1, sidoPicks: [], guesses: [], solved: false });
  });

  it("망가진 값은 새 판으로 떨어진다", () => {
    localStorage.setItem(KEY, "{{{");
    expect(loadQuiz(2).guesses).toEqual([]);
  });

  it("손댄 값이 여섯 번을 넘겨도 잘라 낸다", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        day: 3,
        sidoPicks: [],
        solved: false,
        guesses: Array.from({ length: 20 }, () => ({ name: "x", closeness: "far" })),
      }),
    );
    expect(loadQuiz(3).guesses).toHaveLength(MAX_TRIES);
  });

  it("모르는 색은 버린다", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        day: 4,
        sidoPicks: [],
        solved: false,
        guesses: [{ name: "a", closeness: "hit" }, { name: "b", closeness: "보라" }],
      }),
    );
    expect(loadQuiz(4).guesses).toEqual([{ name: "a", closeness: "hit" }]);
  });
});

import { describe, expect, it } from "vitest";
import { decodeMarks, encodeMarks, MARK, markOf, type Mark } from "./marks";
import type { ItemResult } from "./types";

function result(over: Partial<ItemResult> = {}): ItemResult {
  return {
    id: "x",
    answer: "x",
    elapsedMs: 1,
    keystrokes: 1,
    errors: 0,
    attempts: 1,
    skipped: false,
    hinted: false,
    ...over,
  };
}

describe("한 곳이 어떻게 끝났는가", () => {
  it("한 번에 맞히면 clean이다", () => {
    expect(markOf(result())).toBe(MARK.clean);
  });

  it("힌트든 오답이든 헤맨 것은 하나로 친다", () => {
    // 초성을 본 것과 한 번 틀리고 고쳐 맞힌 것은 같은 일이다.
    expect(markOf(result({ hinted: true }))).toBe(MARK.struggled);
    expect(markOf(result({ errors: 1 }))).toBe(MARK.struggled);
    expect(markOf(result({ attempts: 2 }))).toBe(MARK.struggled);
  });

  it("건너뛰었거나 결과가 없으면 missed다", () => {
    expect(markOf(result({ skipped: true }))).toBe(MARK.missed);
    expect(markOf(undefined)).toBe(MARK.missed);
  });
});

describe("주소에 눌러 담기", () => {
  const roundTrip = (marks: Mark[]) => decodeMarks(encodeMarks(marks), marks.length);

  it("담았다 풀면 그대로다", () => {
    const marks: Mark[] = [MARK.clean, MARK.struggled, MARK.missed, MARK.clean, MARK.struggled];
    expect(roundTrip(marks)).toEqual(marks);
  });

  it("전국 229곳이 주소에 들어갈 길이다", () => {
    // 한 곳에 2비트 → 458비트 → 58바이트 → 78자.
    const marks = Array.from({ length: 229 }, (_, i) => (i % 3) as Mark);
    const code = encodeMarks(marks);
    expect(code.length).toBeLessThanOrEqual(80);
    expect(decodeMarks(code, 229)).toEqual(marks);
  });

  it("서울 25곳은 열 자 남짓이다", () => {
    const code = encodeMarks(Array.from({ length: 25 }, () => MARK.clean));
    expect(code.length).toBeLessThanOrEqual(12);
  });

  it("주소에 넣어도 그대로 나오는 글자만 쓴다", () => {
    const marks = Array.from({ length: 229 }, (_, i) => (i % 3) as Mark);
    const code = encodeMarks(marks);
    expect(encodeURIComponent(code)).toBe(code);
  });

  it("남이 손댄 값은 버린다", () => {
    // 억지로 그리다 어긋난 지도를 보여 주느니 카드가 심심한 편이 낫다.
    expect(decodeMarks("!!!!", 4)).toBeNull();
    expect(decodeMarks("A", 229)).toBeNull();
    expect(decodeMarks("", 4)).toBeNull();
  });
});

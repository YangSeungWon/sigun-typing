import { describe, expect, it } from "vitest";
import { splitNotebooks, type CourseLike } from "./notebooks";
import type { ItemResult } from "../game/types";

const SEOUL: CourseLike = {
  id: "seoul",
  regions: [
    { code: "11320", name: "도봉구" },
    { code: "11305", name: "강북구" },
  ],
};
const BUSAN: CourseLike = {
  id: "busan",
  regions: [
    { code: "26350", name: "해운대구" },
    { code: "26140", name: "중구" },
  ],
};
const NATIONWIDE: CourseLike & { overlapping: boolean } = {
  id: "nationwide",
  overlapping: true,
  regions: [...SEOUL.regions, ...BUSAN.regions],
};
const ALL = [SEOUL, BUSAN, NATIONWIDE];

function result(id: string, answer: string): ItemResult {
  return {
    id,
    answer,
    elapsedMs: 1_000,
    keystrokes: 5,
    errors: 0,
    attempts: 1,
    skipped: false,
    hinted: false,
  };
}

describe("결과를 어느 오답노트에 넣는가", () => {
  it("보통은 한 권이다", () => {
    const books = splitNotebooks([result("11320", "도봉구")], SEOUL, ALL);
    expect(books).toHaveLength(1);
    expect(books[0].courseId).toBe("seoul");
    expect(books[0].peers).toBe(SEOUL.regions);
  });

  it("겹치는 코스는 지역이 원래 속한 코스로 나뉜다", () => {
    /*
     * 이게 이 파일의 존재 이유다. 전국을 돌다 틀린 도봉구가 `nationwide` 노트에
     * 쌓이면, 서울 코스에서 틀린 도봉구와 따로 놀아 같은 짝이 두 번 뜬다.
     */
    const books = splitNotebooks(
      [result("11320", "도봉구"), result("26350", "해운대구")],
      NATIONWIDE,
      ALL,
    );
    expect(books.map((b) => b.courseId).sort()).toEqual(["busan", "seoul"]);
    expect(books.find((b) => b.courseId === "seoul")!.results).toHaveLength(1);
  });

  it("나뉜 노트는 그 코스의 이름들을 상대로 받는다", () => {
    // 오답이 오타인지 착각인지 가릴 때, 상대는 그 시도 안에서 찾아야 한다.
    const books = splitNotebooks([result("26140", "중구")], NATIONWIDE, ALL);
    expect(books[0].peers).toBe(BUSAN.regions);
  });

  it("주인을 못 찾은 결과는 버리지 않는다", () => {
    const books = splitNotebooks([result("99999", "어딘가")], NATIONWIDE, ALL);
    expect(books).toHaveLength(1);
    expect(books[0].courseId).toBe("nationwide");
  });

  it("자기 자신을 주인으로 삼지 않는다", () => {
    // ALL에 자기도 들어 있다. 그걸 집으면 나누는 의미가 없다.
    const books = splitNotebooks([result("11320", "도봉구")], NATIONWIDE, ALL);
    expect(books[0].courseId).toBe("seoul");
  });

  it("결과가 없으면 노트도 없다", () => {
    expect(splitNotebooks([], NATIONWIDE, ALL)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { classifyWrongAnswer, pickConfusionPair } from "./confusion";
import type { MistakeRecord } from "./mistakes";

const SEOUL = [
  { name: "도봉구" },
  { name: "강북구" },
  { name: "중구" },
  { name: "동구", aliases: ["동부"] },
];

function record(over: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    code: "11320",
    name: "도봉구",
    misses: 1,
    cleanStreak: 0,
    lastMissedAt: 1_000,
    ...over,
  };
}

describe("오답 가려내기", () => {
  it("같은 코스의 다른 지역을 치면 착각이다", () => {
    expect(classifyWrongAnswer("강북구", "도봉구", SEOUL)).toBe("강북구");
  });

  it("접미사를 떼고 쳐도 착각으로 본다", () => {
    // place()가 이름에 접미사를 붙여 저장하므로 `강북`은 별칭에 없다. 사람은 그렇게 친다.
    expect(classifyWrongAnswer("강북", "도봉구", SEOUL)).toBe("강북구");
  });

  it("별칭도 그 지역의 표준 표기로 돌려준다", () => {
    expect(classifyWrongAnswer("동부", "도봉구", SEOUL)).toBe("동구");
  });

  it("목표에서 자모 한 개 어긋난 것은 오타지 착각이 아니다", () => {
    expect(classifyWrongAnswer("도봉그", "도봉구", SEOUL)).toBeNull();
  });

  it("한 자모 차이인 오타가 우연히 다른 지역 이름과 같아도 오타다", () => {
    /*
     * 자모 거리 검사가 이름 대조보다 **먼저**여야 한다는 것을 못박는 판이다.
     * 순서가 뒤집히면 목표에서 한 끗 미끄러진 결과가 착각으로 기록된다.
     */
    const peers = [{ name: "중구" }, { name: "중군" }];
    expect(classifyWrongAnswer("중군", "중구", peers)).toBeNull();
  });

  it("코스에 없는 이름은 아무것도 아니다", () => {
    // 비슷한 이름을 찾아 상대를 추정하지 않는다.
    expect(classifyWrongAnswer("부산진구", "도봉구", SEOUL)).toBeNull();
  });

  it("접미사를 뗀 조각이 여러 곳에 걸리면 고르지 않는다", () => {
    const peers = [{ name: "중구" }, { name: "중군" }, { name: "도봉구" }];
    expect(classifyWrongAnswer("중", "도봉구", peers)).toBeNull();
  });

  it("빈 입력과 정답 자신은 걸러진다", () => {
    expect(classifyWrongAnswer("  ", "도봉구", SEOUL)).toBeNull();
    expect(classifyWrongAnswer("도봉구", "도봉구", SEOUL)).toBeNull();
  });
});

describe("헷갈리는 짝 고르기", () => {
  it("한 번뿐인 것은 고르지 않는다", () => {
    const entries = [
      { courseId: "seoul", records: [record({ confusedWith: { 강북구: 1 } })] },
    ];
    expect(pickConfusionPair(entries)).toBeNull();
  });

  it("두 번부터 고른다", () => {
    const entries = [
      { courseId: "seoul", records: [record({ confusedWith: { 강북구: 2 } })] },
    ];
    expect(pickConfusionPair(entries)).toMatchObject({
      courseId: "seoul",
      a: "강북구",
      b: "도봉구",
      count: 2,
    });
  });

  it("양쪽 방향을 합친다", () => {
    // ↔로 쓸 것이므로 아래 숫자가 대칭이 아니면 화살표가 거짓말이 된다.
    const entries = [
      {
        courseId: "seoul",
        records: [
          record({ name: "도봉구", confusedWith: { 강북구: 1 } }),
          record({ code: "11305", name: "강북구", confusedWith: { 도봉구: 1 } }),
        ],
      },
    ];
    expect(pickConfusionPair(entries)?.count).toBe(2);
  });

  it("횟수가 같으면 최근에 틀린 쪽을 고른다", () => {
    const entries = [
      {
        courseId: "seoul",
        records: [
          record({ name: "도봉구", confusedWith: { 강북구: 2 }, lastMissedAt: 1_000 }),
          record({ code: "11140", name: "중구", confusedWith: { 동구: 2 }, lastMissedAt: 9_000 }),
        ],
      },
    ];
    expect(pickConfusionPair(entries)).toMatchObject({ a: "동구", b: "중구" });
  });

  it("혼동 기록이 없는 옛 오답노트에서는 아무것도 안 나온다", () => {
    expect(pickConfusionPair([{ courseId: "seoul", records: [record()] }])).toBeNull();
    expect(pickConfusionPair([])).toBeNull();
  });
});

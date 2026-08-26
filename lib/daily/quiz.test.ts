import { describe, expect, it } from "vitest";
import {
  closeness,
  emptyState,
  isOver,
  MAX_TRIES,
  NEAR,
  quizShareText,
  sidoCleared,
  type QuizState,
} from "./quiz";

const answer = { cx: 500, cy: 500 };

describe("얼마나 가까웠나", () => {
  it("맞히면 초록이다", () => {
    expect(closeness({ cx: 0, cy: 0 }, answer, true)).toBe("hit");
  });

  it("가까우면 노랑, 멀면 빨강이다", () => {
    expect(closeness({ cx: 500 + NEAR - 1, cy: 500 }, answer, false)).toBe("near");
    expect(closeness({ cx: 500 + NEAR + 1, cy: 500 }, answer, false)).toBe("far");
  });

  it("거리는 대각선도 잰다", () => {
    // 가로 30 세로 30이면 실제 거리는 42다. 축마다 따로 재면 안 된다.
    expect(closeness({ cx: 530, cy: 530 }, answer, false)).toBe("far");
  });
});

describe("판이 끝났는가", () => {
  const withGuesses = (n: number, solved = false): QuizState => ({
    ...emptyState(3),
    solved,
    guesses: Array.from({ length: n }, () => ({ name: "x", closeness: "far" as const })),
  });

  it("맞히면 끝이다", () => {
    expect(isOver({ ...withGuesses(2), solved: true })).toBe(true);
  });

  it("여섯 번을 다 쓰면 끝이다", () => {
    expect(isOver(withGuesses(MAX_TRIES - 1))).toBe(false);
    expect(isOver(withGuesses(MAX_TRIES))).toBe(true);
  });
});

describe("시도 계단", () => {
  it("한 번이라도 맞혔으면 통과다", () => {
    // 시도는 횟수를 안 깎는다. 틀려도 계속 고를 수 있어야 한다.
    const state = { ...emptyState(0), sidoPicks: ["11", "41"] };
    expect(sidoCleared(state, "41")).toBe(true);
    expect(sidoCleared(state, "26")).toBe(false);
  });
});

describe("공유 덩어리", () => {
  const solved: QuizState = {
    day: 2,
    sidoPicks: ["41"],
    guesses: [
      { name: "안성시", closeness: "far" },
      { name: "오산시", closeness: "near" },
      { name: "평택시", closeness: "hit" },
    ],
    solved: true,
  };

  it("날짜와 격자가 들어간다", () => {
    const t = quizShareText(solved);
    // 회차(`3일차`)가 아니라 날짜다. 받는 사람이 어느 날 문제인지 아는 값이어야 한다.
    // 해까지 적는다 — 이 문구가 읽히는 날은 오늘이 아닐 수 있다.
    expect(t).toContain("오늘의 퀴즈 2026년 8월 21일");
    expect(t).toContain("🟥🟨🟩");
  });

  it("성적을 숫자로 적지 않는다 — 안 쓴 횟수가 빈 칸으로 남는다", () => {
    const t = quizShareText(solved);
    expect(t).not.toContain("3 / 6");
    expect(t).toContain("🟥🟨🟩⬜⬜⬜");
  });

  it("못 맞힌 판에는 빈 칸이 없다", () => {
    const lost = {
      ...solved,
      solved: false,
      guesses: Array.from({ length: 6 }, () => ({ name: "안성시", closeness: "far" as const })),
    };
    const t = quizShareText(lost);
    expect(t).not.toContain("⬜");
    expect(t).toContain("🟥🟥🟥🟥🟥🟥");
  });

  it("정답을 적지 않는다", () => {
    // 아직 안 푼 사람에게 보내면 그날 문제가 통째로 사라진다.
    const t = quizShareText(solved);
    for (const g of solved.guesses) expect(t).not.toContain(g.name);
  });

  it("시도도 적지 않는다", () => {
    // `경기 3 / 6`을 받으면 첫 질문의 답을 알고 시작한다 — 반쯤 풀린 판이다.
    expect(quizShareText(solved)).not.toContain("경기");
  });

  it("가운데점을 쓰지 않는다", () => {
    expect(quizShareText(solved)).not.toContain("·");
  });

  it("마지막 줄은 초대다", () => {
    expect(quizShareText(solved).trimEnd().endsWith("같이 한 판?")).toBe(true);
  });
});

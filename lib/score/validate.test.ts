import { describe, expect, it } from "vitest";
import { sidoCourse } from "@/data/courses";
import { keystrokeCount } from "../hangul/keystrokes";
import { createGame } from "../game/engine";
import { MODES } from "../game/modes";
import type { ItemResult, Keystroke, Score } from "../game/types";
import { issueToken } from "./session";
import { MAX_PLAUSIBLE_CPM, validateSubmission } from "./validate";
import type { RejectionCode, ScoreSubmission } from "./types";

const ISSUED_AT = 1_700_000_000_000;

/** 재현 가능한 난수. 테스트가 어쩌다 통과하거나 실패하면 안 된다. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface RunOptions {
  /** 타건 간격 하한/상한(ms) */
  minGap?: number;
  maxGap?: number;
  /** 간격 흔들림 없이 일정하게 — 매크로 흉내 */
  robotic?: boolean;
  /** 앞에서부터 이 개수만 친다 */
  limit?: number;
}

/** 사람이 실제로 친 것에 가까운 제출물을 만든다. */
function makeRun(opts: RunOptions = {}) {
  const { minGap = 70, maxGap = 190, robotic = false, limit } = opts;
  const rnd = lcg(42);
  const regions = sidoCourse.regions.slice(0, limit ?? sidoCourse.regions.length);

  const keystrokes: Keystroke[] = [];
  const results: ItemResult[] = [];
  let t = 0;

  for (const region of regions) {
    const strokes = keystrokeCount(region.name);
    const start = t;
    for (let i = 0; i < strokes; i++) {
      t += robotic ? minGap : minGap + Math.floor(rnd() * (maxGap - minGap));
      keystrokes.push({ t, n: 1, ok: true });
    }
    results.push({
      id: region.code,
      answer: region.name,
      elapsedMs: t - start,
      keystrokes: strokes,
      errors: 0,
      attempts: 1,
      skipped: false,
      hinted: false,
    });
  }

  const correctKeystrokes = results.reduce((a, r) => a + r.keystrokes, 0);
  const elapsedMs = t;
  const claimed: Score = {
    cpm: (correctKeystrokes / elapsedMs) * 60_000,
    accuracy: 1,
    elapsedMs,
    correctKeystrokes,
    totalErrors: 0,
    completed: results.length,
    total: sidoCourse.regions.length,
    hintsUsed: 0,
    firstTry: results.length,
    answerRate: 1,
  };

  const { token } = issueToken(
    { courseId: sidoCourse.id, courseVersion: sidoCourse.version, mode: "learn", seed: 1 },
    ISSUED_AT,
  );

  const submission: ScoreSubmission = {
    token,
    courseId: sidoCourse.id,
    mode: "learn",
    seed: 1,
    nickname: "테스터",
    keystrokes,
    results,
    claimed,
  };

  // 제출은 게임이 끝난 직후 도착한다.
  return { submission, arrivedAt: ISSUED_AT + elapsedMs + 400 };
}

function codesOf(result: ReturnType<typeof validateSubmission>): RejectionCode[] {
  return result.ok ? [] : result.rejections.map((r) => r.code);
}

describe("정상 기록", () => {
  it("사람이 친 기록은 통과한다", () => {
    const { submission, arrivedAt } = makeRun();
    const result = validateSubmission(submission, arrivedAt);
    expect(codesOf(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("점수는 클라이언트 주장이 아니라 서버가 다시 계산한다", () => {
    const { submission, arrivedAt } = makeRun();
    const expectedStrokes = sidoCourse.regions.reduce(
      (a, r) => a + keystrokeCount(r.name),
      0,
    );
    // 주장 점수를 부풀려도 서버 계산값이 나와야 한다 — 다만 불일치로 거부된다.
    const result = validateSubmission(submission, arrivedAt);
    if (!result.ok) throw new Error("통과했어야 합니다");
    expect(result.score.correctKeystrokes).toBe(expectedStrokes);
    expect(result.score.completed).toBe(sidoCourse.regions.length);
    expect(result.score.cpm).toBeLessThan(MAX_PLAUSIBLE_CPM);
  });

  it("중간에 그만둔 기록도 통과한다", () => {
    const { submission, arrivedAt } = makeRun({ limit: 5 });
    const result = validateSubmission(submission, arrivedAt);
    expect(codesOf(result)).toEqual([]);
  });
});

describe("토큰", () => {
  it("서명이 조작되면 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const tampered = { ...submission, token: submission.token.slice(0, -3) + "aaa" };
    expect(codesOf(validateSubmission(tampered, arrivedAt))).toEqual(["bad_token"]);
  });

  it("내용을 바꿔치기하면 서명이 깨져 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const payload = Buffer.from(
      JSON.stringify({
        sessionId: "x",
        courseId: "gyeonggi",
        mode: "learn",
        seed: 1,
        issuedAt: ISSUED_AT,
      }),
    ).toString("base64url");
    const forged = { ...submission, token: `${payload}.${submission.token.split(".")[1]}` };
    expect(codesOf(validateSubmission(forged, arrivedAt))).toEqual(["bad_token"]);
  });

  it("만료된 토큰은 거부한다", () => {
    const { submission } = makeRun();
    const late = ISSUED_AT + 2 * 60 * 60 * 1000;
    expect(codesOf(validateSubmission(submission, late))).toEqual(["bad_token"]);
  });

  it("토큰과 다른 코스로 제출하면 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const swapped = { ...submission, courseId: "gangwon" };
    expect(codesOf(validateSubmission(swapped, arrivedAt))).toContain("course_mismatch");
  });

  it("토큰과 다른 모드로 제출하면 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const swapped = { ...submission, mode: "map" as const };
    expect(codesOf(validateSubmission(swapped, arrivedAt))).toContain("mode_mismatch");
  });
});

describe("타수 조작", () => {
  it("지역명보다 많은 타수를 주장하면 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const inflated = {
      ...submission,
      results: submission.results.map((r, i) =>
        i === 0 ? { ...r, keystrokes: r.keystrokes + 50 } : r,
      ),
    };
    expect(codesOf(validateSubmission(inflated, arrivedAt))).toContain("keystroke_mismatch");
  });

  it("주장 점수가 서버 계산과 다르면 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const lying = {
      ...submission,
      claimed: { ...submission.claimed, correctKeystrokes: 9_999 },
    };
    expect(codesOf(validateSubmission(lying, arrivedAt))).toContain("score_mismatch");
  });

  it("코스에 없는 지역을 끼워 넣으면 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const fake = {
      ...submission,
      results: submission.results.map((r, i) =>
        i === 2 ? { ...r, id: "99999", answer: "없는곳" } : r,
      ),
    };
    expect(codesOf(validateSubmission(fake, arrivedAt))).toContain("unknown_region");
  });

  it("순서를 뒤바꾸면 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const shuffled = {
      ...submission,
      results: [submission.results[1], submission.results[0], ...submission.results.slice(2)],
    };
    expect(codesOf(validateSubmission(shuffled, arrivedAt))).toContain("unknown_region");
  });
});

describe("시간 조작", () => {
  it("실제로 흐른 시간보다 오래 플레이했다고 주장하면 거부한다", () => {
    const { submission } = makeRun();
    // 게임이 끝나기도 전에 제출이 도착한 셈
    const tooEarly = ISSUED_AT + 1_000;
    expect(codesOf(validateSubmission(submission, tooEarly))).toContain(
      "elapsed_exceeds_wallclock",
    );
  });

  it("타건 시각이 되돌아가면 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const reversed = {
      ...submission,
      keystrokes: submission.keystrokes.map((k, i) =>
        i === 10 ? { ...k, t: 0 } : k,
      ),
    };
    expect(codesOf(validateSubmission(reversed, arrivedAt))).toContain("time_travel");
  });

  it("음수 시각은 거부한다", () => {
    const { submission, arrivedAt } = makeRun();
    const negative = {
      ...submission,
      keystrokes: [{ t: -5, n: 1, ok: true }, ...submission.keystrokes],
    };
    expect(codesOf(validateSubmission(negative, arrivedAt))).toContain("time_travel");
  });
});

describe("비인간 입력", () => {
  it("사람 한계를 넘는 타수는 거부한다", () => {
    // 타건 간격 2ms — 3000타/분 수준
    const { submission, arrivedAt } = makeRun({ minGap: 2, maxGap: 4 });
    expect(codesOf(validateSubmission(submission, arrivedAt))).toContain("too_fast");
  });

  it("간격이 물리적으로 불가능하면 거부한다", () => {
    const { submission, arrivedAt } = makeRun({ minGap: 2, maxGap: 4 });
    expect(codesOf(validateSubmission(submission, arrivedAt))).toContain(
      "impossible_interval",
    );
  });

  it("간격이 기계적으로 일정하면 거부한다", () => {
    const { submission, arrivedAt } = makeRun({ minGap: 100, robotic: true });
    expect(codesOf(validateSubmission(submission, arrivedAt))).toContain("robotic_rhythm");
  });

  it("사람다운 흔들림은 리듬 검사를 통과한다", () => {
    const { submission, arrivedAt } = makeRun({ minGap: 90, maxGap: 260 });
    expect(codesOf(validateSubmission(submission, arrivedAt))).not.toContain(
      "robotic_rhythm",
    );
  });

  it("표본이 적으면 리듬을 문제 삼지 않는다 — 오탐 방지", () => {
    // 서울·인천 두 곳이면 타건 수가 적어 리듬 판정 근거가 부족하다.
    const { submission, arrivedAt } = makeRun({ limit: 2, minGap: 100, robotic: true });
    expect(codesOf(validateSubmission(submission, arrivedAt))).not.toContain(
      "robotic_rhythm",
    );
  });
});

describe("초성 힌트 페널티", () => {
  /** 퀴즈는 시드로 섞이므로 엔진과 똑같은 순서로 만들어야 한다. */
  /** 값을 여기 박아 두면 페널티를 조정할 때마다 테스트가 거짓으로 깨진다. */
  const HINT_MS = MODES.map.hintPenaltyMs!;

  function makeQuizRun(hintsUsed: number) {
    const items = createGame(
      sidoCourse.regions.map((r) => ({ id: r.code, answer: r.name, aliases: r.aliases })),
      MODES.map,
      ISSUED_AT,
      1,
    ).items;

    const rnd = lcg(11);
    const keystrokes: Keystroke[] = [];
    const results: ItemResult[] = [];
    let t = 0;
    for (const item of items) {
      const strokes = keystrokeCount(item.answer);
      const start = t;
      for (let i = 0; i < strokes; i++) {
        t += 80 + Math.floor(rnd() * 120);
        keystrokes.push({ t, n: 1, ok: true });
      }
      results.push({
        id: item.id,
        answer: item.answer,
        elapsedMs: t - start,
        keystrokes: strokes,
        errors: 0,
        attempts: 1,
        skipped: false,
        hinted: false,
      });
    }

    const correctKeystrokes = results.reduce((a, r) => a + r.keystrokes, 0);
    const { token } = issueToken(
      { courseId: sidoCourse.id, courseVersion: sidoCourse.version, mode: "map", seed: 1 },
      ISSUED_AT,
    );
    const submission: ScoreSubmission = {
      token,
      courseId: sidoCourse.id,
      mode: "map",
      seed: 1,
      nickname: "테스터",
      keystrokes,
      results,
      hintsUsed,
      claimed: {
        cpm: 0,
        accuracy: 1,
        elapsedMs: t,
        correctKeystrokes,
        totalErrors: 0,
        firstTry: results.length,
        answerRate: 1,
        completed: results.length,
        total: sidoCourse.regions.length,
        hintsUsed,
      },
    };
    // 힌트 시간까지 실제로 흐른 것으로 본다.
    return { submission, arrivedAt: ISSUED_AT + t + hintsUsed * HINT_MS + 500 };
  }

  it("힌트를 쓰면 서버가 기록에 시간을 더한다", () => {
    const none = validateSubmission(makeQuizRun(0).submission, makeQuizRun(0).arrivedAt);
    const three = validateSubmission(makeQuizRun(3).submission, makeQuizRun(3).arrivedAt);
    if (!none.ok || !three.ok) throw new Error("둘 다 통과했어야 합니다");
    expect(three.score.elapsedMs - none.score.elapsedMs).toBe(3 * HINT_MS);
    expect(three.score.cpm).toBeLessThan(none.score.cpm);
    expect(three.score.hintsUsed).toBe(3);
  });

  it("항목 수보다 많은 힌트는 잘라 낸다", () => {
    const { submission, arrivedAt } = makeQuizRun(0);
    const lying = { ...submission, hintsUsed: 9_999 };
    const result = validateSubmission(lying, arrivedAt + 17 * HINT_MS);
    if (!result.ok) throw new Error(JSON.stringify(result.rejections));
    expect(result.score.hintsUsed).toBe(sidoCourse.regions.length);
  });

  it("음수 힌트로 시간을 줄일 수 없다", () => {
    const { submission, arrivedAt } = makeQuizRun(0);
    const cheating = { ...submission, hintsUsed: -100 };
    const result = validateSubmission(cheating, arrivedAt);
    if (!result.ok) throw new Error(JSON.stringify(result.rejections));
    expect(result.score.hintsUsed).toBe(0);
  });

  it("힌트가 없는 모드에서는 페널티가 붙지 않는다", () => {
    const { submission, arrivedAt } = makeRun();
    const result = validateSubmission({ ...submission, hintsUsed: 5 }, arrivedAt);
    if (!result.ok) throw new Error(JSON.stringify(result.rejections));
    expect(result.score.hintsUsed).toBe(0);
  });
});

describe("코스 판번호", () => {
  it("판번호가 다른 토큰은 거부한다", () => {
    // 판을 시작한 뒤 배포로 코스가 바뀌면 서로 다른 문제를 푼 기록이 섞인다.
    const { submission, arrivedAt } = makeRun();
    const stale = issueToken(
      { courseId: sidoCourse.id, courseVersion: sidoCourse.version + 1, mode: "learn", seed: 1 },
      ISSUED_AT,
    );
    const result = validateSubmission(
      { ...submission, token: stale.token },
      arrivedAt,
    );
    expect(codesOf(result)).toContain("course_version_mismatch");
  });

  it("판번호가 같으면 통과한다", () => {
    const { submission, arrivedAt } = makeRun();
    expect(codesOf(validateSubmission(submission, arrivedAt))).toEqual([]);
  });
});

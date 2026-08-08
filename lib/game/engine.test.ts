import { describe, expect, it } from "vitest";
import {
  createGame,
  giveUp,
  revealHint,
  settleReveal,
  settle,
  remainingMs,
  score,
  setInput,
  skip,
  start,
  tick,
} from "./engine";
import { MODES } from "./modes";
import type { GameItem, GameState } from "./types";

const ITEMS: GameItem[] = [
  { id: "41111", answer: "수원", aliases: ["수원시"] },
  { id: "41131", answer: "안양" },
  { id: "41190", answer: "부천" },
];

/** 한 글자씩(자모 단위가 아닌 완성 글자 단위) 쳐 넣는 헬퍼. */
function type(state: GameState, text: string, startAt = 0, stepMs = 100): GameState {
  // 정답 직후에는 전환 상태다. 화면에서는 다음 프레임의 tick이 풀어 준다.
  let s = settle(state);
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    s = setInput(s, chars.slice(0, i + 1).join(""), startAt + (i + 1) * stepMs);
  }
  return s;
}

describe("createGame", () => {
  it("싱글은 코스 순서를 유지한다", () => {
    const g = createGame(ITEMS, MODES.single, 0);
    expect(g.items.map((i) => i.answer)).toEqual(["수원", "안양", "부천"]);
    expect(g.status).toBe("ready");
  });

  it("같은 시드는 같은 순서를 만든다 — 멀티와 서버 재생에 필요", () => {
    const a = createGame(ITEMS, MODES.timeattack, 0, 42);
    const b = createGame(ITEMS, MODES.timeattack, 0, 42);
    const c = createGame(ITEMS, MODES.timeattack, 0, 7);
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
    expect(a.items).toHaveLength(ITEMS.length);
    // 시드가 다르면 순서도 달라야 한다 (3개짜리라 우연히 같을 수 있어 집합만 확인)
    expect(new Set(c.items.map((i) => i.id))).toEqual(new Set(ITEMS.map((i) => i.id)));
  });
});

describe("진행", () => {
  it("정답을 완성하면 자동으로 다음 항목으로 넘어간다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원");
    expect(g.index).toBe(1);
    expect(g.input).toBe("");
    expect(g.results).toHaveLength(1);
    expect(g.results[0].skipped).toBe(false);
  });

  it("별칭도 정답으로 인정한다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원시");
    expect(g.index).toBe(1);
  });

  it("조합 중에는 넘어가지 않는다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = setInput(g, "수", 100);
    expect(g.index).toBe(0);
    expect(g.itemErrors).toBe(0);
  });

  it("마지막 항목을 끝내면 게임이 종료된다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    expect(g.status).toBe("finished");
    expect(g.results).toHaveLength(3);
  });
});

describe("오타", () => {
  it("정답 경로를 벗어나면 오류 1회", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = setInput(g, "소", 100);
    expect(g.itemErrors).toBe(1);
    expect(g.offTrack).toBe(true);
  });

  it("틀린 채로 계속 쳐도 오류는 늘지 않는다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = setInput(g, "소", 100);
    g = setInput(g, "소어", 200);
    g = setInput(g, "소어라", 300);
    expect(g.itemErrors).toBe(1);
  });

  it("지우고 다시 맞게 치면 경로에 복귀한다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = setInput(g, "소", 100);
    g = setInput(g, "", 200);
    expect(g.offTrack).toBe(false);
    g = type(g, "수원", 200);
    expect(g.index).toBe(1);
    expect(g.results[0].errors).toBe(1);
  });
});

describe("타임어택", () => {
  it("제한 시간이 지나면 종료된다", () => {
    let g = start(createGame(ITEMS, MODES.timeattack, 0, 1), 0);
    expect(tick(g, 59_000).status).toBe("playing");
    g = tick(g, 61_000);
    expect(g.status).toBe("finished");
  });

  it("오답은 남은 시간을 깎는다", () => {
    let g = start(createGame(ITEMS, MODES.timeattack, 0, 1), 0);
    const before = remainingMs(g, 1_000);
    g = setInput(g, "쿄", 1_000); // 어떤 항목이든 정답 경로가 아닌 입력
    expect(remainingMs(g, 1_000)).toBe(before - MODES.timeattack.penaltyMs!);
  });

  it("차감이 누적되면 시간이 먼저 끝난다", () => {
    let g = start(createGame(ITEMS, MODES.timeattack, 0, 1), 0);
    for (let i = 0; i < 30; i++) {
      g = setInput(g, "쿄", 1_000 + i * 10);
      g = setInput(g, "", 1_005 + i * 10);
    }
    expect(remainingMs(g, 1_500)).toBeLessThanOrEqual(0);
    expect(tick(g, 1_500).status).toBe("finished");
  });
});

describe("건너뛰기", () => {
  it("싱글에서는 건너뛸 수 없다", () => {
    const g = start(createGame(ITEMS, MODES.single, 0), 0);
    expect(skip(g, 100).index).toBe(0);
  });

  it("퀴즈에서는 건너뛰면 다음으로 넘어가고 skipped로 기록된다", () => {
    const g = skip(start(createGame(ITEMS, MODES.quiz, 0, 1), 0), 100);
    expect(g.index).toBe(1);
    expect(g.results[0].skipped).toBe(true);
    expect(g.results[0].keystrokes).toBe(0);
  });
});

describe("score", () => {
  it("정답 타수와 경과 시간으로 CPM을 낸다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);

    const s = score(g, g.endedAt!);
    // 수원 6타 + 안양 6타 + 부천 5타
    expect(s.correctKeystrokes).toBe(17);
    expect(s.completed).toBe(3);
    expect(s.total).toBe(3);
    expect(s.cpm).toBeCloseTo((17 / s.elapsedMs) * 60_000, 5);
  });

  it("오타 없이 끝내면 정확도 100%", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    expect(score(g, g.endedAt!).accuracy).toBe(1);
  });

  it("오타가 섞이면 정확도가 떨어진다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = setInput(g, "소", 100);
    g = setInput(g, "", 200);
    g = type(g, "수원", 200);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    const s = score(g, g.endedAt!);
    expect(s.accuracy).toBeLessThan(1);
    expect(s.totalErrors).toBe(1);
  });

  it("시작만 하고 아무것도 안 치면 0타", () => {
    const g = start(createGame(ITEMS, MODES.single, 0), 0);
    const s = score(g, 5_000);
    expect(s.correctKeystrokes).toBe(0);
    expect(s.cpm).toBe(0);
    expect(s.accuracy).toBe(1);
  });
});

describe("상태 보호", () => {
  it("ready 상태에서는 입력을 받지 않는다", () => {
    const g = createGame(ITEMS, MODES.single, 0);
    expect(setInput(g, "수", 100)).toBe(g);
  });

  it("finished 상태에서는 입력을 받지 않는다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    expect(setInput(g, "가", 3000)).toBe(g);
  });
});

describe("모르겠어요", () => {
  it("정답을 보여 주고, 사람이 넘길 때까지 기다린다", () => {
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    const answer = g.items[0].answer;
    g = giveUp(g, 1_000);
    expect(g.status).toBe("revealing");
    expect(g.revealed?.answer).toBe(answer);

    // 시간이 지났다고 알아서 넘어가지 않는다. 읽는 속도는 사람마다 다르다.
    g = tick(g, 60_000);
    expect(g.status).toBe("revealing");
    expect(g.revealed?.answer).toBe(answer);

    g = settleReveal(g);
    expect(g.status).toBe("playing");
    expect(g.revealed).toBeNull();
    expect(g.index).toBe(1);
  });

  it("정답을 봤다고 점수에서 이득이 없다", () => {
    // 이득이 생기면 힌트가 아니라 지름길이 된다.
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    g = giveUp(g, 1_000);
    expect(g.results[0].skipped).toBe(true);
    expect(g.results[0].keystrokes).toBe(0);
    expect(score(g, 2_000).completed).toBe(0);
  });

  it("마지막 문제에서 포기하면 바로 끝난다", () => {
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    for (let i = 0; i < ITEMS.length; i++) {
      g = giveUp(g, 1_000 * (i + 1));
      g = settleReveal(g);
    }
    expect(g.status).toBe("finished");
  });

  it("정답을 보여 주는 동안에도 제한 시간은 흐른다", () => {
    let g = start(createGame(ITEMS, MODES.timeattack, 0, 1), 0);
    g = giveUp(g, 1_000);
    expect(g.status).toBe("revealing");
    g = tick(g, MODES.timeattack.timeLimitMs! + 1);
    expect(g.status).toBe("finished");
  });

  it("포기를 막은 모드에서는 아무 일도 없다", () => {
    const g = start(createGame(ITEMS, MODES.multi, 0, 1), 0);
    expect(giveUp(g, 1_000)).toBe(g);
  });
});

describe("초성 힌트", () => {
  it("퀴즈에서는 힌트를 열 수 있다", () => {
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    g = revealHint(g);
    expect(g.hintShown).toBe(true);
    expect(g.hintsUsed).toBe(1);
  });

  it("같은 항목에서 두 번 눌러도 한 번만 센다", () => {
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    g = revealHint(revealHint(g));
    expect(g.hintsUsed).toBe(1);
  });

  it("다음 항목으로 넘어가면 힌트가 다시 닫힌다", () => {
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    g = revealHint(g);
    g = skip(g, 100);
    expect(g.hintShown).toBe(false);
    expect(g.hintsUsed).toBe(1);
  });

  it("정답을 보여주는 모드에서는 힌트가 없다", () => {
    const g = start(createGame(ITEMS, MODES.single, 0), 0);
    expect(revealHint(g)).toBe(g);
  });

  it("힌트 사용 횟수가 점수에 실린다", () => {
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    g = revealHint(g);
    expect(score(g, 1000).hintsUsed).toBe(1);
  });

  it("힌트에서 정답까지 걸린 시간이 항목 기록에 남는다", () => {
    // 힌트를 여는 순간만 세면 그 힌트가 통했는지 알 수 없다.
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    const answer = g.items[0].answer;
    g = revealHint(g, 3_000);
    // 한 글자당 100ms씩이므로 두 글자면 마지막 타건은 5_700이다.
    g = type(g, answer, 5_500);
    expect(answer.length).toBe(2);
    expect(g.results[0].hintToAnswerMs).toBe(2_700);
  });

  it("힌트를 보고도 건너뛴 항목에는 남지 않는다", () => {
    // 그 시간은 "초성을 보고도 답을 못 낸 시간"이지 힌트가 통한 시간이 아니다.
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    g = revealHint(g, 3_000);
    g = skip(g, 5_500);
    expect(g.results[0].hinted).toBe(true);
    expect(g.results[0].hintToAnswerMs).toBeUndefined();
  });

  it("힌트를 안 본 항목에는 그 시간이 없다", () => {
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    g = skip(g, 1_000);
    expect(g.results[0].hintToAnswerMs).toBeUndefined();
    expect(g.results[0].hinted).toBe(false);
  });

  it("힌트는 기록에 시간으로 가산된다", () => {
    const plain = score(start(createGame(ITEMS, MODES.quiz, 0, 1), 0), 10_000);
    let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
    g = revealHint(g);
    const hinted = score(g, 10_000);
    expect(hinted.elapsedMs).toBe(plain.elapsedMs + MODES.quiz.hintPenaltyMs!);
  });

  it("힌트를 쓰면 같은 타수라도 타수/분이 낮아진다", () => {
    const run = (useHint: boolean) => {
      let g = start(createGame(ITEMS, MODES.quiz, 0, 1), 0);
      if (useHint) g = revealHint(g);
      const target = g.items[0].answer;
      g = type(g, target, 0);
      return score(g, 3_000);
    };
    expect(run(true).cpm).toBeLessThan(run(false).cpm);
  });

  it("타임어택 오답은 기록을 늘리지 않는다 — 이중 처벌 방지", () => {
    let g = start(createGame(ITEMS, MODES.timeattack, 0, 1), 0);
    g = setInput(g, "쿄", 500);
    expect(g.hintPenaltyMs).toBe(0);
    expect(score(g, 10_000).elapsedMs).toBe(10_000);
  });
});

describe("전환 상태", () => {
  it("정답 직후에는 전환 상태가 된다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원");
    expect(g.status).toBe("transitioning");
  });

  it("전환 중에는 입력을 받지 않는다 — 이전 조합의 잔여물이기 때문", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원");
    const ignored = setInput(g, "ㄴ", 500);
    expect(ignored).toBe(g);
  });

  it("tick이 다음 프레임에 전환을 푼다 — 판이 잠기지 않는다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원");
    g = tick(g, 600);
    expect(g.status).toBe("playing");
    expect(setInput(g, "안", 700).input).toBe("안");
  });

  it("마지막 항목을 끝내면 전환이 아니라 종료다", () => {
    let g = start(createGame(ITEMS, MODES.single, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    expect(g.status).toBe("finished");
  });
});

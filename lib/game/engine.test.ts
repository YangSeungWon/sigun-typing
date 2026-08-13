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
  submit,
  skip,
  start,
  tick,
} from "./engine";
import { keystrokeCount } from "../hangul/keystrokes";
import { MODES } from "./modes";
import type { ModeConfig } from "./types";
import type { GameItem, GameState } from "./types";

const ITEMS: GameItem[] = [
  { id: "41111", answer: "수원", aliases: ["수원시"] },
  { id: "41131", answer: "안양" },
  { id: "41190", answer: "부천" },
];

/**
 * 한 글자씩(자모 단위가 아닌 완성 글자 단위) 쳐 넣고 스페이스로 제출한다.
 *
 * 제출까지가 한 항목이다 — 다 쳤다고 저절로 넘어가지 않는다.
 */
function type(state: GameState, text: string, startAt = 0, stepMs = 100): GameState {
  // 정답 직후에는 전환 상태다. 화면에서는 다음 프레임의 tick이 풀어 준다.
  let s = settle(state);
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    s = setInput(s, chars.slice(0, i + 1).join(""), startAt + (i + 1) * stepMs);
  }
  return setInput(s, `${text} `, startAt + (chars.length + 1) * stepMs);
}

/**
 * 시간 제한이 붙은 판.
 *
 * 화면에 그런 모드를 두지는 않지만(판은 본편과 연습 둘뿐이다) 엔진은 제한
 * 시간을 다룰 줄 알아야 한다 — 멀티나 이벤트 판이 언제든 이 설정으로 돌 수
 * 있고, 시간이 다 되면 판이 끝나는 규칙 자체는 엔진의 일이다.
 */
const TIMED: ModeConfig = {
  ...MODES.map,
  id: "map",
  timeLimitMs: 60_000,
  penaltyMs: 2_000,
};

describe("createGame", () => {
  it("싱글은 코스 순서를 유지한다", () => {
    const g = createGame(ITEMS, MODES.learn, 0);
    expect(g.items.map((i) => i.answer)).toEqual(["수원", "안양", "부천"]);
    expect(g.status).toBe("ready");
  });

  it("같은 시드는 같은 순서를 만든다 — 멀티와 서버 재생에 필요", () => {
    const a = createGame(ITEMS, TIMED, 0, 42);
    const b = createGame(ITEMS, TIMED, 0, 42);
    const c = createGame(ITEMS, TIMED, 0, 7);
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
    expect(a.items).toHaveLength(ITEMS.length);
    // 시드가 다르면 순서도 달라야 한다 (3개짜리라 우연히 같을 수 있어 집합만 확인)
    expect(new Set(c.items.map((i) => i.id))).toEqual(new Set(ITEMS.map((i) => i.id)));
  });
});

describe("진행", () => {
  it("정답을 완성하면 자동으로 다음 항목으로 넘어간다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원");
    expect(g.index).toBe(1);
    expect(g.input).toBe("");
    expect(g.results).toHaveLength(1);
    expect(g.results[0].skipped).toBe(false);
  });

  it("별칭도 정답으로 인정한다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원시");
    expect(g.index).toBe(1);
  });

  it("조합 중에는 넘어가지 않는다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = setInput(g, "수", 100);
    expect(g.index).toBe(0);
    expect(g.itemErrors).toBe(0);
  });

  it("마지막 항목을 끝내면 게임이 종료된다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    expect(g.status).toBe("finished");
    expect(g.results).toHaveLength(3);
  });
});

describe("오타", () => {
  it("경로를 벗어나도 세지 않는다 — 표시만 남는다", () => {
    // 손이 미끄러진 것과 몰라서 틀린 것은 다르다. 판정은 제출로만 한다.
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = setInput(g, "소", 100);
    expect(g.itemErrors).toBe(0);
    expect(g.offTrack, "판면을 흔들 신호는 남아야 한다").toBe(true);
  });

  it("틀린 채로 계속 쳐도 세지 않는다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = setInput(g, "소", 100);
    g = setInput(g, "소어", 200);
    g = setInput(g, "소어라", 300);
    expect(g.itemErrors).toBe(0);
  });

  it("지우고 다시 맞게 치면 경로에 복귀한다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = setInput(g, "소", 100);
    g = setInput(g, "", 200);
    expect(g.offTrack).toBe(false);
    g = type(g, "수원", 200);
    expect(g.index).toBe(1);
    // 지우고 고쳐서 맞혔으면 틀린 적이 없는 것이다.
    expect(g.results[0].errors).toBe(0);
    expect(g.results[0].keystrokes, "타수는 제출한 답에서 나온다").toBe(
      keystrokeCount("수원"),
    );
  });
});

describe("타임어택", () => {
  it("제한 시간이 지나면 종료된다", () => {
    let g = start(createGame(ITEMS, TIMED, 0, 1), 0);
    expect(tick(g, 59_000).status).toBe("playing");
    g = tick(g, 61_000);
    expect(g.status).toBe("finished");
  });

  // 회상 모드이므로 시간을 깎는 것은 오답 **제출**이다. 치는 도중에는
  // 아무 일도 일어나지 않는다 — 그래야 지웠다 다시 칠 수 있다.
  it("오답 제출은 남은 시간을 깎는다", () => {
    let g = start(createGame(ITEMS, TIMED, 0, 1), 0);
    const before = remainingMs(g, 1_000);
    g = setInput(g, "쿄", 1_000);
    expect(remainingMs(g, 1_000)).toBe(before);
    g = submit(g, 1_000);
    expect(remainingMs(g, 1_000)).toBe(before - TIMED.penaltyMs!);
  });

  it("차감이 누적되면 시간이 먼저 끝난다", () => {
    let g = start(createGame(ITEMS, TIMED, 0, 1), 0);
    // 매번 다른 답을 낸다. 같은 답을 또 내는 것은 새 오답으로 세지 않는다.
    for (let i = 0; i < 30; i++) {
      g = setInput(g, i % 2 === 0 ? "쿄" : "탸", 1_000 + i * 10);
      g = submit(g, 1_005 + i * 10);
    }
    expect(remainingMs(g, 1_500)).toBeLessThanOrEqual(0);
    expect(tick(g, 1_500).status).toBe("finished");
  });
});

describe("건너뛰기", () => {
  it("싱글에서는 건너뛸 수 없다", () => {
    const g = start(createGame(ITEMS, MODES.learn, 0), 0);
    expect(skip(g, 100).index).toBe(0);
  });

  it("퀴즈에서는 건너뛰면 다음으로 넘어가고 skipped로 기록된다", () => {
    const g = skip(start(createGame(ITEMS, MODES.map, 0, 1), 0), 100);
    expect(g.index).toBe(1);
    expect(g.results[0].skipped).toBe(true);
    expect(g.results[0].keystrokes).toBe(0);
  });
});

describe("score", () => {
  it("정답 타수와 경과 시간으로 CPM을 낸다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
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
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    expect(score(g, g.endedAt!).accuracy).toBe(1);
  });

  it("치다가 지운 것은 정확도를 깎지 않는다", () => {
    /*
     * 제출 때만 평가한다. 한 글자 잘못 눌러 지우고 다시 친 것까지 분모에
     * 넣으면, 손이 미끄러진 것과 몰라서 틀린 것이 같은 값으로 찍힌다.
     */
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = setInput(g, "소", 100);
    g = setInput(g, "", 200);
    g = type(g, "수원", 200);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    const s = score(g, g.endedAt!);
    expect(s.accuracy).toBe(1);
    expect(s.totalErrors).toBe(0);
  });

  it("틀리게 제출하면 정확도가 떨어진다", () => {
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    const answer = g.items[0].answer;
    const wrong = ITEMS.map((i) => i.answer).find((n) => n !== answer)!;
    g = submit(setInput(g, wrong, 100), 200);
    g = submit(setInput(g, answer, 300), 400);
    const s = score(g, 500);
    expect(s.accuracy).toBeLessThan(1);
    expect(s.totalErrors).toBe(1);
  });

  it("시작만 하고 아무것도 안 치면 0타", () => {
    const g = start(createGame(ITEMS, MODES.learn, 0), 0);
    const s = score(g, 5_000);
    expect(s.correctKeystrokes).toBe(0);
    expect(s.cpm).toBe(0);
    expect(s.accuracy).toBe(1);
  });
});

describe("상태 보호", () => {
  it("ready 상태에서는 입력을 받지 않는다", () => {
    const g = createGame(ITEMS, MODES.learn, 0);
    expect(setInput(g, "수", 100)).toBe(g);
  });

  it("finished 상태에서는 입력을 받지 않는다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    expect(setInput(g, "가", 3000)).toBe(g);
  });
});

describe("모르겠어요", () => {
  it("정답을 보여 주고, 사람이 넘길 때까지 기다린다", () => {
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    const answer = g.items[0].answer;
    g = giveUp(g, 1_000);
    expect(g.status).toBe("revealing");
    expect(g.revealed?.answer).toBe(answer);

    // 시간이 지났다고 알아서 넘어가지 않는다. 읽는 속도는 사람마다 다르다.
    g = tick(g, 60_000);
    expect(g.status).toBe("revealing");
    expect(g.revealed?.answer).toBe(answer);

    g = settleReveal(g, 9_500);
    expect(g.status).toBe("playing");
    expect(g.revealed).toBeNull();
    expect(g.index).toBe(1);
  });

  it("정답을 봤다고 점수에서 이득이 없다", () => {
    // 이득이 생기면 힌트가 아니라 지름길이 된다.
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    g = giveUp(g, 1_000);
    expect(g.results[0].skipped).toBe(true);
    expect(g.results[0].keystrokes).toBe(0);
    expect(score(g, 2_000).completed).toBe(0);
  });

  it("마지막 문제도 정답을 쓴 뒤에 끝난다", () => {
    /*
     * 한때 마지막만 예외였다. 포기하면 답을 보기도 전에 결과가 떴다 —
     * 어차피 결과 화면이 못 맞힌 곳을 이름으로 보여 준다는 이유였는데,
     * 이 기능이 하려는 일은 보여 주는 것이 아니라 손으로 쓰게 하는 것이다.
     */
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    // 섞이는 모드라 마지막 문제는 판이 정한다. 원본 배열의 끝이 아니다.
    const last = g.items[g.items.length - 1].answer;
    for (let i = 0; i < g.items.length - 1; i++) {
      g = giveUp(g, 1_000 * (i + 1));
      g = settleReveal(g, 1_000 * (i + 1) + 100);
    }
    g = giveUp(g, 9_000);
    expect(g.status, "마지막에도 정답을 보여 준다").toBe("revealing");
    expect(g.revealed?.answer).toBe(last);

    g = settleReveal(g, 9_500);
    expect(g.status).toBe("finished");
    /*
     * 시계는 베껴 쓰는 동안에도 간다. 다른 문제에서는 그 시간이 전부 기록에
     * 들어가므로(끝은 판이 끝날 때 한 번 찍힌다) 마지막만 공짜면 앞뒤가 안 맞는다.
     */
    expect(g.endedAt).toBe(9_500);
  });

  it("정답을 보여 주는 동안에도 제한 시간은 흐른다", () => {
    let g = start(createGame(ITEMS, TIMED, 0, 1), 0);
    g = giveUp(g, 1_000);
    expect(g.status).toBe("revealing");
    g = tick(g, TIMED.timeLimitMs! + 1);
    expect(g.status).toBe("finished");
  });

  it("포기를 막은 모드에서는 아무 일도 없다", () => {
    const g = start(createGame(ITEMS, MODES.multi, 0, 1), 0);
    expect(giveUp(g, 1_000)).toBe(g);
  });
});

describe("초성 힌트", () => {
  it("퀴즈에서는 힌트를 열 수 있다", () => {
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    g = revealHint(g);
    expect(g.hintShown).toBe(true);
    expect(g.hintsUsed).toBe(1);
  });

  it("같은 항목에서 두 번 눌러도 한 번만 센다", () => {
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    g = revealHint(revealHint(g));
    expect(g.hintsUsed).toBe(1);
  });

  it("다음 항목으로 넘어가면 힌트가 다시 닫힌다", () => {
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    g = revealHint(g);
    g = skip(g, 100);
    expect(g.hintShown).toBe(false);
    expect(g.hintsUsed).toBe(1);
  });

  it("정답을 보여주는 모드에서는 힌트가 없다", () => {
    const g = start(createGame(ITEMS, MODES.learn, 0), 0);
    expect(revealHint(g)).toBe(g);
  });

  it("힌트 사용 횟수가 점수에 실린다", () => {
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    g = revealHint(g);
    expect(score(g, 1000).hintsUsed).toBe(1);
  });

  it("힌트에서 정답까지 걸린 시간이 항목 기록에 남는다", () => {
    // 힌트를 여는 순간만 세면 그 힌트가 통했는지 알 수 없다.
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    const answer = g.items[0].answer;
    g = revealHint(g, 3_000);
    // 한 글자당 100ms씩이므로 두 글자면 마지막 타건은 5_700이다.
    g = type(g, answer, 5_500);
    expect(answer.length).toBe(2);
    // 두 글자 + 제출까지 세 번. 제출이 정답의 일부이므로 그 시간도 들어간다.
    expect(g.results[0].hintToAnswerMs).toBe(2_800);
  });

  it("힌트를 보고도 건너뛴 항목에는 남지 않는다", () => {
    // 그 시간은 "초성을 보고도 답을 못 낸 시간"이지 힌트가 통한 시간이 아니다.
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    g = revealHint(g, 3_000);
    g = skip(g, 5_500);
    expect(g.results[0].hinted).toBe(true);
    expect(g.results[0].hintToAnswerMs).toBeUndefined();
  });

  it("힌트를 안 본 항목에는 그 시간이 없다", () => {
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    g = skip(g, 1_000);
    expect(g.results[0].hintToAnswerMs).toBeUndefined();
    expect(g.results[0].hinted).toBe(false);
  });

  it("힌트는 기록에 시간으로 가산된다", () => {
    const plain = score(start(createGame(ITEMS, MODES.map, 0, 1), 0), 10_000);
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    g = revealHint(g);
    const hinted = score(g, 10_000);
    expect(hinted.elapsedMs).toBe(plain.elapsedMs + MODES.map.hintPenaltyMs!);
  });

  it("힌트를 쓰면 같은 타수라도 타수/분이 낮아진다", () => {
    const run = (useHint: boolean) => {
      let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
      if (useHint) g = revealHint(g);
      const target = g.items[0].answer;
      g = type(g, target, 0);
      return score(g, 3_000);
    };
    expect(run(true).cpm).toBeLessThan(run(false).cpm);
  });

  it("타임어택 오답은 기록을 늘리지 않는다 — 이중 처벌 방지", () => {
    let g = start(createGame(ITEMS, TIMED, 0, 1), 0);
    g = setInput(g, "쿄", 500);
    expect(g.hintPenaltyMs).toBe(0);
    expect(score(g, 10_000).elapsedMs).toBe(10_000);
  });
});

describe("전환 상태", () => {
  it("정답 직후에는 전환 상태가 된다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원");
    expect(g.status).toBe("transitioning");
  });

  it("전환 중에는 입력을 받지 않는다 — 이전 조합의 잔여물이기 때문", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원");
    const ignored = setInput(g, "ㄴ", 500);
    expect(ignored).toBe(g);
  });

  it("tick이 다음 프레임에 전환을 푼다 — 판이 잠기지 않는다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원");
    g = tick(g, 600);
    expect(g.status).toBe("playing");
    expect(setInput(g, "안", 700).input).toBe("안");
  });

  it("마지막 항목을 끝내면 전환이 아니라 종료다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0), 0);
    g = type(g, "수원", 0);
    g = type(g, "안양", 1000);
    g = type(g, "부천", 2000);
    expect(g.status).toBe("finished");
  });
});

/*
 * 회상 모드의 제출 규칙.
 *
 * 접두사 판정만 있던 시절에는 틀린 답을 아예 제출할 수가 없었다. 지우는 것
 * 말고 길이 없으니 "안산을 연천으로 착각했다"가 기록에 남지 않았고, 치는
 * 도중에 빨갛게 뜨는 것이 공짜 힌트 노릇을 했다.
 */
describe("엔터 제출", () => {
  const recall = () => start(createGame(ITEMS, MODES.map, 0, 1), 0);

  it("치는 동안에는 오답으로 세지 않는다", () => {
    let g = recall();
    g = setInput(g, "쿄", 100);
    expect(g.itemErrors).toBe(0);
    expect(g.offTrack).toBe(false);
    expect(g.rejectedAt).toBeNull();
  });

  it("틀린 답을 제출해도 입력은 그대로 남는다 — 틀린 자리만 고친다", () => {
    let g = recall();
    const answer = g.items[0].answer;
    const wrong = ITEMS.map((i) => i.answer).find((n) => n !== answer)!;
    g = setInput(g, wrong, 100);
    g = submit(g, 200);
    expect(g.index).toBe(0);
    expect(g.input).toBe(wrong);
    expect(g.itemWrong).toEqual([wrong]);
    expect(g.itemErrors).toBe(1);
    expect(g.rejectedAt).toBe(200);
  });

  it("같은 답을 또 내도 오답이 두 번 세지지 않는다", () => {
    // 입력이 남으므로 엔터만 한 번 더 눌러도 같은 답이 다시 접수된다.
    let g = recall();
    const answer = g.items[0].answer;
    const wrong = ITEMS.map((i) => i.answer).find((n) => n !== answer)!;
    g = submit(setInput(g, wrong, 100), 200);
    g = submit(g, 300);
    expect(g.itemWrong).toEqual([wrong]);
    expect(g.itemErrors).toBe(1);
    expect(g.rejectedAt, "판은 다시 한 번 빨개진다").toBe(300);
  });

  it("틀린 뒤 맞히면 시도 횟수와 오답이 결과에 남는다", () => {
    let g = recall();
    const answer = g.items[0].answer;
    const wrong = ITEMS.map((i) => i.answer).find((n) => n !== answer)!;
    g = submit(setInput(g, wrong, 100), 200);
    g = submit(setInput(g, answer, 300), 400);
    expect(g.results[0].attempts).toBe(2);
    expect(g.results[0].wrongAnswers).toEqual([wrong]);
    expect(g.results[0].skipped).toBe(false);
  });

  it("한 번에 맞히면 시도는 1이고 오답 목록은 없다", () => {
    let g = recall();
    g = submit(setInput(g, g.items[0].answer, 100), 200);
    expect(g.results[0].attempts).toBe(1);
    expect(g.results[0].wrongAnswers).toBeUndefined();
  });

  /*
   * 다 쳤다고 저절로 넘어가지 않는다. `전남`을 칠 때 ㅁ을 누르는 순간
   * 화면이 바뀌면, 조합이 끝나기도 전에 판이 손을 잡아채는 느낌이 된다.
   */
  it("다 쳐도 제출하기 전에는 넘어가지 않는다", () => {
    let g = recall();
    g = setInput(g, g.items[0].answer, 100);
    expect(g.index).toBe(0);
    expect(g.results).toHaveLength(0);
    g = submit(g, 200);
    expect(g.index).toBe(1);
  });

  it("스페이스도 제출이다 — 타수로는 세지 않는다", () => {
    let g = recall();
    const answer = g.items[0].answer;
    g = setInput(g, answer, 100);
    const before = g.lastKeystrokeCount;
    g = setInput(g, `${answer} `, 200);
    expect(g.index).toBe(1);
    expect(g.results[0].keystrokes).toBe(before);
  });

  it("빈 칸에서 스페이스를 눌러도 아무 일도 없다", () => {
    let g = recall();
    g = setInput(g, " ", 100);
    expect(g.index).toBe(0);
    expect(g.itemErrors).toBe(0);
  });

  it("빈 채로 엔터를 쳐도 벌하지 않는다", () => {
    let g = recall();
    const before = g;
    g = submit(g, 100);
    expect(g).toBe(before);
  });

  it("따라치기에서도 판정은 제출에서만 한다", () => {
    let g = start(createGame(ITEMS, MODES.learn, 0, 1), 0);
    g = setInput(g, "쿄", 100);
    // 치는 동안에는 어느 모드에서도 세지 않는다 — 지우고 고칠 자유가 있다.
    expect(g.itemErrors).toBe(0);
    g = submit(g, 200);
    expect(g.itemErrors).toBe(1);
    expect(g.itemWrong).toEqual(["쿄"]);
  });

  it("오답 제출 전의 타수는 정답 타수로 치지 않는다", () => {
    let g = recall();
    const answer = g.items[0].answer;
    const wrong = ITEMS.map((i) => i.answer).find((n) => n !== answer)!;
    g = submit(setInput(g, wrong, 100), 200);
    g = submit(setInput(g, answer, 300), 400);
    // 정답에 든 타수만 남는다. 헛친 타수는 분모(친 타수)에만 남아 정확도를 낮춘다.
    expect(g.results[0].keystrokes).toBe(keystrokeCount(answer));
    expect(score(g, 500).accuracy).toBeLessThan(1);
  });

  it("틀린 자리만 고쳐 맞혀도 타수는 온전히 남는다", () => {
    // 오답이 화면에 남으므로 대부분은 지웠다 다시 치는 대신 뒷글자만 고친다.
    // 그때 앞글자의 타수까지 깎이면 고쳐 쓰는 사람만 손해를 본다.
    let g = recall();
    const answer = g.items[0].answer;
    const chars = [...answer];
    const wrong = `${chars.slice(0, -1).join("")}쿄`;
    g = submit(setInput(g, wrong, 100), 200);
    // 마지막 글자만 지우고 다시 친다.
    g = setInput(g, chars.slice(0, -1).join(""), 300);
    g = submit(setInput(g, answer, 400), 500);
    expect(g.results[0].keystrokes).toBe(keystrokeCount(answer));
  });

  it("첫 제출에 맞힌 수가 정확도가 된다", () => {
    let g = recall();
    const wrongFor = (a: string) => ITEMS.map((i) => i.answer).find((n) => n !== a)!;
    // 첫 곳만 한 번 틀리고, 나머지는 한 번에 맞힌다.
    g = submit(setInput(g, wrongFor(g.items[0].answer), 100), 200);
    for (let i = 0; i < ITEMS.length; i++) {
      g = tick(g, 300 + i * 200);
      g = submit(setInput(g, g.items[g.index].answer, 300 + i * 200), 400 + i * 200);
    }
    const s = score(g, 1_000);
    expect(s.completed).toBe(3);
    expect(s.firstTry).toBe(2);
    // 정확도는 곳 기준이다 — 끝낸 곳 중 한 번에 맞힌 비율.
    expect(s.accuracy).toBeCloseTo(2 / 3);
  });
});

/*
 * 포기한 자리에서 정답을 **손으로 한 번 쓴다.**
 *
 * 눈으로만 보고 지나가면 다음에 또 모른다. 어차피 타자 게임이므로 이 게임이
 * 학습에 보탤 수 있는 것이 정확히 그 지점이다.
 */
describe("정답 베껴 쓰기", () => {
  const stuck = () => {
    let g = start(createGame(ITEMS, MODES.map, 0, 1), 0);
    return giveUp(g, 100);
  };

  it("포기하면 정답을 보여 주는 상태로 들어간다", () => {
    const g = stuck();
    expect(g.status).toBe("revealing");
    expect(g.revealed?.answer).toBe(g.results[0].answer);
  });

  it("아무거나 쳐서는 넘어가지 않는다", () => {
    let g = stuck();
    g = setInput(g, "ㄱ", 200);
    expect(g.status).toBe("revealing");
    expect(g.revealInput).toBe("ㄱ");
  });

  it("정답을 다 쓰고 제출하면 넘어간다", () => {
    let g = stuck();
    const answer = g.revealed!.answer;
    g = setInput(g, `${answer} `, 200);
    expect(g.status).toBe("playing");
    expect(g.revealed).toBeNull();
    expect(g.revealInput).toBe("");
  });

  it("베껴 쓴 타건은 점수에 들어가지 않는다", () => {
    let g = stuck();
    const before = g.keystrokes.length;
    const answer = g.revealed!.answer;
    g = setInput(g, answer, 200);
    g = setInput(g, `${answer} `, 300);
    expect(g.keystrokes.length).toBe(before);
    // 포기한 항목은 여전히 0타에 오답이다. 베껴 썼다고 점수가 생기지 않는다.
    expect(g.results[0].keystrokes).toBe(0);
    expect(g.results[0].skipped).toBe(true);
  });

  it("쓰기 싫으면 빠져나갈 수 있다 — 막다른 길을 만들지 않는다", () => {
    const g = settleReveal(stuck(), 200);
    expect(g.status).toBe("playing");
  });
});

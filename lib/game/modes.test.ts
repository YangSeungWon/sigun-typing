import { describe, expect, it } from "vitest";
import { MODES, MODE_LABELS, MODE_LADDER } from "./modes";

/**
 * 이 게임의 정체성을 붙들어 두는 테스트다.
 *
 * 한 번은 진입장벽을 낮추려다 본편을 따라치기로 바꿔 버렸고, 그러자 답이
 * 화면에 적혀 있는데 지도가 그 지역을 가리키는 화면이 나왔다. 다음에 또
 * 같은 유혹이 왔을 때 여기서 걸린다.
 */
describe("모드 구성", () => {
  it("답을 보여 주는 모드는 연습 하나뿐이다", () => {
    const revealing = Object.values(MODES)
      .filter((mode) => mode.reveal)
      .map((mode) => mode.id);
    expect(revealing).toEqual(["single"]);
  });

  it("사다리는 본편에서 시작한다", () => {
    expect(MODE_LADDER[0]).toBe("quiz");
    expect(MODE_LADDER).toContain("single");
  });

  it("회상 모드에는 막혔을 때 빠져나갈 길이 있다", () => {
    // 힌트도 포기도 없으면, 한 곳을 모르는 순간 그 판을 끝낼 방법이 없어진다.
    // 창을 닫는 것 말고 길이 없는 상태는 어려운 게 아니라 망가진 것이다.
    for (const mode of Object.values(MODES)) {
      if (mode.reveal) continue;
      expect(mode.allowHint || mode.allowSkip, mode.id).toBe(true);
    }
  });

  it("힌트에는 값이 매겨져 있다", () => {
    for (const mode of Object.values(MODES)) {
      // 멀티는 예외다. 순위가 벽시계로 갈리므로 힌트를 읽는 동안
      // 상대가 앞서 나가는 것이 이미 값이다.
      if (!mode.allowHint || mode.id === "multi") continue;
      expect(mode.hintPenaltyMs ?? 0, mode.id).toBeGreaterThan(0);
    }
  });

  it("모든 모드에 이름이 있다", () => {
    for (const id of Object.keys(MODES)) {
      expect(MODE_LABELS[id as keyof typeof MODE_LABELS]).toBeTruthy();
    }
  });
});

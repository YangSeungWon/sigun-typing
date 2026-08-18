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
    expect(revealing).toEqual(["learn"]);
  });

  it("사다리는 본편에서 시작한다", () => {
    expect(MODE_LADDER[0]).toBe("map");
    expect(MODE_LADDER).toContain("learn");
  });

  it("회상 모드에는 막혔을 때 빠져나갈 길이 있다", () => {
    // 힌트도 포기도 없으면, 한 곳을 모르는 순간 그 판을 끝낼 방법이 없어진다.
    // 창을 닫는 것 말고 길이 없는 상태는 어려운 게 아니라 망가진 것이다.
    for (const mode of Object.values(MODES)) {
      if (mode.reveal) continue;
      expect(mode.allowHint || mode.allowSkip, mode.id).toBe(true);
    }
  });

  it("힌트에 시간을 물리지 않는다 — 횟수로 센다", () => {
    /*
     * 한때 한 번에 30초를 얹었다. 그 무게가 코스 길이에 따라 널뛰어서
     * (제주 두 곳에서는 판이 끝장나고 전국 229곳에서는 티도 안 났다)
     * 시간에서 떼어 냈다. 순위는 힌트 적은 순, 그다음이 시간이다.
     */
    for (const mode of Object.values(MODES)) {
      expect(mode.hintPenaltyMs ?? 0, mode.id).toBe(0);
    }
  });

  it("모든 모드에 이름이 있다", () => {
    for (const id of Object.keys(MODES)) {
      expect(MODE_LABELS[id as keyof typeof MODE_LABELS]).toBeTruthy();
    }
  });
});

/*
 * 답이 화면에 있으면 즉시 판정, 없으면 제출 판정이다.
 *
 * 이 둘이 어긋나면 두 가지 중 하나가 벌어진다. 가린 모드에서 즉시 판정하면
 * 글자 색이 답을 흘리고, 답이 보이는 모드에서 엔터를 요구하면 아무 뜻도
 * 없는 키를 하나 더 치게 한다.
 */
describe("판정 시점", () => {
  it("정답이 보이는 모드만 즉시 판정한다", () => {
    for (const config of Object.values(MODES)) {
      expect([config.id, config.judge]).toEqual([
        config.id,
        config.reveal ? "live" : "enter",
      ]);
    }
  });
});

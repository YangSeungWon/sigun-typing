import { describe, expect, it } from "vitest";
import { focusTransform, mainPathBox, pathBox } from "./bbox";

describe("path 사각형", () => {
  it("좌표를 훑어 최소·최대를 찾는다", () => {
    expect(pathBox("M10,20L30,20L30,50L10,50Z")).toEqual({
      x: 10, y: 20, width: 20, height: 30,
    });
  });

  it("음수와 소수를 다룬다", () => {
    expect(pathBox("M-5.5,0.5L4.5,10.5Z")).toEqual({
      x: -5.5, y: 0.5, width: 10, height: 10,
    });
  });

  it("좌표가 없으면 빈 사각형", () => {
    expect(pathBox("")).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("본체 사각형", () => {
  it("섬이 딸린 지역은 가장 큰 덩어리를 본체로 본다", () => {
    // 본토 100×100, 멀리 떨어진 섬 4×4. 전체를 감싸면 500×500이 되어
    // "이미 큰 지역"으로 잘못 판단한다.
    const d = "M0,0L100,0L100,100L0,100ZM496,496L500,496L500,500L496,500Z";
    expect(mainPathBox(d)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(pathBox(d)).toEqual({ x: 0, y: 0, width: 500, height: 500 });
  });

  it("덩어리가 하나면 그대로다", () => {
    expect(mainPathBox("M10,10L20,20Z")).toEqual({ x: 10, y: 10, width: 10, height: 10 });
  });
});

describe("지금 문제로 당기는 변환", () => {
  const view = { width: 1000, height: 1000 };
  const region = (d: string) => ({ code: "x", name: "x", d, cx: 0, cy: 0 });

  it("지역이 없으면 아무것도 하지 않는다", () => {
    expect(focusTransform(undefined, view)).toBe("");
  });

  it("CSS transform 문법으로 낸다 — 그래야 이동이 이어진다", () => {
    /*
     * SVG의 transform 속성으로 걸면 브라우저에 따라 트랜지션이 붙지 않아
     * 지도가 다음 지역으로 뚝 끊긴 채 튄다. 단위와 쉼표가 있어야 CSS
     * transform 속성으로 걸 수 있다.
     */
    const t = focusTransform(region("M400,400L440,400L440,440L400,440Z"), view);
    expect(t).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\)/);
    expect(t, "공백으로 끊는 SVG 속성 문법이면 안 된다").not.toMatch(
      /translate\(-?[\d.]+ -?[\d.]+\)/,
    );
  });

  it("섬 때문에 확대를 포기하지 않는다", () => {
    const withIsland = region("M400,400L440,400L440,440L400,440ZM10,900L14,904Z");
    expect(focusTransform(withIsland, view)).not.toContain("scale(1)");
  });

  it("작은 지역일수록 크게 당긴다 — 다만 상한이 있다", () => {
    // 상한이 없으면 구 하나가 화면을 꽉 채워 주변이 다 잘린다.
    // 이 게임에서 주변 모양은 문제의 일부다.
    const tiny = focusTransform(region("M500,500L502,502Z"), view, { maxScale: 4 });
    expect(tiny).toContain("scale(4)");
  });

  it("이미 큰 지역은 당기지 않는다", () => {
    const huge = focusTransform(region("M0,0L1000,1000Z"), view);
    expect(huge).toContain("scale(1)");
  });

  it("가장자리 지역에서도 지도 밖 여백을 끌어오지 않는다", () => {
    // 좌상단 구석을 가운데로 옮기면 지도 바깥이 화면 절반을 차지한다.
    const corner = focusTransform(region("M0,0L10,10Z"), view, { maxScale: 2 });
    const [, x, y] = corner.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/) ?? [];
    // 배율 2에서 중심은 (250,250)보다 안쪽으로 밀려 있어야 한다.
    expect(Number(x)).toBeLessThanOrEqual(-250);
    expect(Number(y)).toBeLessThanOrEqual(-250);
  });
});

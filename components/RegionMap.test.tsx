import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RegionMap } from "./RegionMap";
import type { CourseGeo } from "@/data/geo/types";
import gangwon from "@/data/geo/gangwon.json";

const geo = gangwon as CourseGeo;

/**
 * 지역이 아닌 겹의 수.
 *
 * 물길은 면·선 두 장, 고도띠는 한 단마다 한 장. 둘을 땅 안에 가두는
 * clipPath는 한 장을 같이 쓴다.
 */
function extras(g: CourseGeo): number {
  const layers = (g.water ? 2 : 0) + (g.terrain?.length ?? 0);
  return layers ? layers + 1 : 0;
}

/**
 * 지도는 게임이 시작된 뒤에만 붙으므로 서버 HTML만 봐서는 확인할 수 없다.
 * 대신 컴포넌트를 정적 마크업으로 그려 실제로 유효한 SVG가 나오는지 본다.
 */
describe("RegionMap", () => {
  it("모든 지역을 path로 그린다", () => {
    const html = renderToStaticMarkup(<RegionMap geo={geo} variant="route" />);
    /*
     * 지역 수 + 맨 아래 실루엣 한 장 + 현재 지역 테두리 한 장.
     *
     * 테두리는 그릴 것이 없어도 자리를 지킨다. 조건을 걸면 카운트다운이
     * 끝나는 순간 새로 태어나면서 트랜지션을 못 타고 지도와 따로 논다.
     *
     * 물길과 지형은 세지 않는다. 있는 코스와 없는 코스가 갈리고, 이 검사가
     * 보는 것은 **지역이 다 그려졌는가**이지 지도에 무엇이 더 얹혔는가가
     * 아니다.
     */
    const shapes = (html.match(/<path/g) ?? []).length;
    expect(shapes - extras(geo)).toBe(geo.regions.length + 2);
    expect(html).toContain(`viewBox="0 0 ${geo.width} ${geo.height}"`);
  });

  /**
   * 노랑은 "네가 답해야 할 것"만 가리킨다.
   * 이름을 보여 주는 모드에서 현재 지역까지 노랗게 칠했더니, 지도는 문제를
   * 내는 것처럼 보이는데 답은 판에 적혀 있어 무엇을 맞히는지 알 수 없었다.
   */
  it("문제를 내는 지도에서만 현재 지역이 노랗다", () => {
    const [first, second] = geo.regions;
    const html = renderToStaticMarkup(
      <RegionMap
        geo={geo}
        variant="hint"
        passedCodes={[first.code]}
        currentCode={second.code}
      />,
    );
    expect(html).toContain("var(--color-sign)");
    expect(html).toContain("var(--color-centerline)");
    // 실루엣 한 장과 현재 지역 강조 테두리가 한 겹씩 더 붙는다.
    const shapes = (html.match(/<path/g) ?? []).length;
    expect(shapes - extras(geo)).toBe(geo.regions.length + 2);
  });

  it("진행을 보여 주는 지도에서는 노랑을 쓰지 않는다", () => {
    const [first, second] = geo.regions;
    const html = renderToStaticMarkup(
      <RegionMap
        geo={geo}
        variant="route"
        passedCodes={[first.code]}
        currentCode={second.code}
      />,
    );
    expect(html).not.toContain("var(--color-centerline)");
    // 지금 위치는 곧 칠해질 곳이라는 뜻의 밝은 초록으로 표시한다.
    expect(html).toContain("var(--color-sign-hi)");
  });

  it("퀴즈 단서에는 지역 이름이 새어 나오지 않는다", () => {
    const target = geo.regions[3];
    const html = renderToStaticMarkup(
      <RegionMap geo={geo} variant="hint" currentCode={target.code} />,
    );
    for (const r of geo.regions) {
      expect(html, `${r.name} 노출됨`).not.toContain(r.name);
    }
  });
});

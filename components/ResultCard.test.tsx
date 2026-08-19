import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultCard } from "./ResultCard";
import type { CourseGeo } from "@/data/geo/types";
import type { ItemResult, Score } from "@/lib/game/types";
import geoJson from "@/data/geo/seoul.json";

const geo = geoJson as unknown as CourseGeo;
const codes = geo.regions.map((r) => r.code);

const score: Score = {
  cpm: 300,
  accuracy: 0.9,
  elapsedMs: 41_080,
  correctKeystrokes: 100,
  totalErrors: 2,
  completed: 24,
  total: 25,
  hintsUsed: 3,
  firstTry: 20,
};

function skipped(code: string): ItemResult {
  return {
    id: code,
    answer: code,
    elapsedMs: 1,
    keystrokes: 0,
    errors: 0,
    attempts: 1,
    skipped: true,
    hinted: false,
  };
}

describe("결과 화면의 지도", () => {
  /**
   * 판이 끝난 뒤에도 색이 갈려야 한다.
   *
   * 게임 중 지도와 공유 격자와 카드가 전부 초록·노랑·빨강인데 결과 지도만
   * 두 색이면, 정작 가장 오래 들여다보는 화면이 다른 말을 한다.
   */
  it("헤맨 곳이 노랑으로 뜬다", () => {
    const html = renderToStaticMarkup(
      <ResultCard
        courseName="서울 25개 구"
        modeLabel="지도 타이핑"
        score={score}
        geo={geo}
        passedCodes={codes.slice(0, 24)}
        struggledCodes={codes.slice(0, 3)}
        missed={[skipped(codes[24])]}
        coursesHref="/courses"
        onRestart={() => {}}
      />,
    );
    expect(html).toContain("var(--color-centerline)");
    expect(html).toContain("var(--color-sign)");
    expect(html).toContain("var(--color-alert)");
  });

  it("범례가 세 상태를 각각 센다", () => {
    const html = renderToStaticMarkup(
      <ResultCard
        courseName="서울 25개 구"
        modeLabel="지도 타이핑"
        score={score}
        geo={geo}
        passedCodes={codes.slice(0, 24)}
        struggledCodes={codes.slice(0, 3)}
        missed={[skipped(codes[24])]}
        coursesHref="/courses"
        onRestart={() => {}}
      />,
    );
    // 24곳을 끝냈고 그중 셋을 헤맸으니 한 번에 맞힌 곳은 스물하나다.
    expect(html).toContain("한 번에 21");
    expect(html).toContain("헤맨 곳 3");
    expect(html).toContain("다시 볼 곳 1");
  });

  it("다 한 번에 맞히면 범례를 띄우지 않는다", () => {
    // 한 종류밖에 없으면 그건 범례가 아니라 설명문이다.
    const html = renderToStaticMarkup(
      <ResultCard
        courseName="서울 25개 구"
        modeLabel="지도 타이핑"
        score={{ ...score, completed: 25, hintsUsed: 0 }}
        geo={geo}
        passedCodes={codes}
        coursesHref="/courses"
        onRestart={() => {}}
      />,
    );
    // "한 번에"는 아래 통계 줄에도 쓰이므로 범례의 색으로 확인한다.
    expect(html).not.toContain("var(--color-centerline)");
    expect(html).not.toContain("헤맨 곳");
    expect(html).not.toContain("다시 볼 곳");
  });
});

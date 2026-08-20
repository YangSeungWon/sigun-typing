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

describe("도전장 대조", () => {
  const done = { ...score, completed: 25, elapsedMs: 38_950 };

  it("이기면 얼마나 앞섰는지 적는다", () => {
    const html = renderToStaticMarkup(
      <ResultCard
        courseName="서울 25개 구"
        modeLabel="지도 타이핑"
        score={done}
        geo={geo}
        passedCodes={codes}
        challenge={{ beatMs: 41_080, by: "승원" }}
        coursesHref="/courses"
        onRestart={() => {}}
      />,
    );
    expect(html).toContain("승원님을 2.13초 앞섰습니다");
  });

  it("져도 적는다", () => {
    // 얼마나 모자랐는지가 다시 할 이유다. 숨기면 그냥 안 알려 주는 화면이 된다.
    const html = renderToStaticMarkup(
      <ResultCard
        courseName="서울 25개 구"
        modeLabel="지도 타이핑"
        score={done}
        geo={geo}
        passedCodes={codes}
        challenge={{ beatMs: 30_000, by: "승원" }}
        coursesHref="/courses"
        onRestart={() => {}}
      />,
    );
    expect(html).toContain("승원님에게 8.95초 뒤졌습니다");
  });

  it("이름이 없으면 기록끼리 견준다", () => {
    const html = renderToStaticMarkup(
      <ResultCard
        courseName="서울 25개 구"
        modeLabel="지도 타이핑"
        score={done}
        geo={geo}
        passedCodes={codes}
        challenge={{ beatMs: 41_080, by: null }}
        coursesHref="/courses"
        onRestart={() => {}}
      />,
    );
    expect(html).toContain("받은 기록보다 2.13초 빠릅니다");
  });

  it("다 돌지 못한 판에는 승패를 매기지 않는다", () => {
    // 스물다섯 중 스물만 치고 빨랐다고 이겼다고 하면 그건 거짓말이다.
    const html = renderToStaticMarkup(
      <ResultCard
        courseName="서울 25개 구"
        modeLabel="지도 타이핑"
        score={{ ...score, completed: 20, elapsedMs: 20_000 }}
        geo={geo}
        passedCodes={codes.slice(0, 20)}
        challenge={{ beatMs: 41_080, by: "승원" }}
        missed={[skipped(codes[24])]}
        coursesHref="/courses"
        onRestart={() => {}}
      />,
    );
    expect(html).not.toContain("앞섰습니다");
    expect(html).toContain("목표 00:41.08");
  });
});

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
    // 24곳을 끝냈고 그중 셋을 헤맸으니 바로 맞힌 곳은 스물하나다.
    expect(html).toContain("바로 맞힘 21");
    expect(html).toContain("헤매다 맞힘 3");
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
    // "바로 맞힘"은 아래 통계 줄에도 쓰이므로 범례의 색으로 확인한다.
    expect(html).not.toContain("var(--color-centerline)");
    expect(html).not.toContain("헤매다 맞힘");
    expect(html).not.toContain("다시 볼 곳");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultCard } from "./ResultCard";
import type { CourseGeo } from "@/data/geo/types";
import type { ItemResult, Score } from "@/lib/game/types";
import sido from "@/data/geo/sido.json";

const geo = sido as CourseGeo;

const score: Score = {
  completed: 16,
  total: 17,
  elapsedMs: 32_310,
  hintsUsed: 3,
  totalErrors: 1,
  cpm: 300,
  accuracy: 0.97,
  correctKeystrokes: 120,
  firstTry: 13,
};

function markup(missed: ItemResult[]) {
  return renderToStaticMarkup(
    <ResultCard
      courseName="전국 17 시도"
      modeLabel="지도 타이핑"
      score={score}
      geo={geo}
      missed={missed}
      coursesHref="/courses"
      onRestart={() => {}}
    />,
  );
}

function item(answer: string, wrongAnswers: string[]): ItemResult {
  return {
    id: geo.regions.find((r) => r.name === answer)!.code,
    answer,
    wrongAnswers,
    errors: wrongAnswers.length,
    attempts: wrongAnswers.length + 1,
    hinted: false,
    skipped: false,
    keystrokes: 6,
    elapsedMs: 2000,
  };
}

describe("다시 볼 곳", () => {
  it("오타는 뭐라고 쳤는지 적지 않는다", () => {
    /*
     * `광주 → 과주라고 답함`이 떴었다. 과주는 지명이 아니라 손이 미끄러진
     * 자국이고, 그걸 적어 주는 것은 틀렸다는 통보를 한 번 더 하는 일이다.
     */
    const html = markup([item("광주", ["과주"])]);
    expect(html).toContain("광주");
    expect(html).not.toContain("과주");
  });

  it("다른 지역과 헷갈린 것은 적는다", () => {
    // 이건 다르다. 두 곳을 나란히 보는 것이 다시 외우는 가장 빠른 길이다.
    const html = markup([item("전북", ["전남"])]);
    expect(html).toContain("전남");
  });
});

describe("세 상태는 배타적이다", () => {
  /*
   * `한 번에 13`, `헤맨 곳 3`, `다시 볼 곳 1`, 버튼은 `틀린 2곳` — 한 화면에서
   * `다시 볼 곳`이 두 숫자를 가리켰다. 범례의 셋은 합이 코스 전체여야 하고,
   * `다시 볼 곳`은 뒤의 둘을 합친 하나의 뜻이어야 한다.
   */
  it("범례는 한 번에 + 헤맴 + 못 맞힘으로 갈린다", () => {
    const html = renderToStaticMarkup(
      <ResultCard
        courseName="전국 17 시도"
        modeLabel="지도 타이핑"
        score={score}
        geo={geo}
        struggledCodes={[geo.regions[0].code]}
        missed={[item("전북", ["전남"]), { ...item("광주", []), skipped: true }]}
        coursesHref="/courses"
        onRestart={() => {}}
      />,
    );
    // 표지판과 범례가 같은 값을 같은 이름으로 부른다.
    expect(html).toContain("한 번에 15 / 17");
    expect(html).toContain("한 번에 15");
    expect(html).not.toContain("첫 입력");
    expect(html).toContain("헤맨 곳 1");
    // 못 맞힌 곳은 건너뛴 하나뿐이다. 상자 이름(다시 볼 곳)과 겹치지 않는다.
    expect(html).toContain("못 맞힌 곳 1");
    expect(html).toContain("다시 볼 곳 2");
  });
});

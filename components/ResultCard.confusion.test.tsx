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
  cleanFirstTries: 13,
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
    revealed: false,
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

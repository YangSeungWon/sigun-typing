import { describe, expect, it } from "vitest";
import { COURSES } from "@/data/courses";
import { atlasLearnUrl } from "./atlas";

describe("옆 사이트로 가는 문", () => {
  /*
   * 죽은 딥링크는 없는 것만 못하다. 저쪽 주소는 코스 아이디에서 규칙으로
   * 만들어 내므로, 규칙이 코스 목록 전체를 덮는지 여기서 붙잡는다.
   *
   * 실제로 살아 있는지는 이 검사가 볼 수 없다(네트워크를 타지 않는다).
   * 붙일 때 전부 확인했고, 저쪽 주소 체계가 바뀌면 이 검사가 아니라 사람이
   * 알아채야 하는 종류의 일이다.
   */
  it("세종 말고는 모든 코스에 갈 곳이 있다", () => {
    const missing = COURSES.filter((c) => !atlasLearnUrl(c.id, "test")).map((c) => c.id);
    expect(missing.every((id) => id.split("-")[0] === "sejong")).toBe(true);
  });

  it("광역시는 시군구, 도는 시군으로 간다", () => {
    expect(atlasLearnUrl("seoul", "notes")).toContain("/ko/learn/sigungu/seoul/");
    expect(atlasLearnUrl("gangwon", "notes")).toContain("/ko/learn/sigun/gangwon/");
    expect(atlasLearnUrl("sido", "notes")).toContain("/ko/learn/sido/");
  });

  it("읍면동 코스는 그 시도의 학습 지도로 간다", () => {
    // 저쪽에 동 단위가 없다. 한 단계 위로 보내는 편이 아무 데도 안 보내는 것보다 낫다.
    expect(atlasLearnUrl("gangwon-chuncheon", "notes")).toContain("/ko/learn/sigun/gangwon/");
    expect(atlasLearnUrl("seoul-jongno", "notes")).toContain("/ko/learn/sigungu/seoul/");
  });

  it("어디서 넘어왔는지를 싣는다", () => {
    expect(atlasLearnUrl("seoul", "notes")).toContain("utm_medium=notes");
  });
});

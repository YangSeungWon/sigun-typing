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

  it("읍면동 코스는 시군구 코드로 그 동 지도에 바로 닿는다", () => {
    expect(atlasLearnUrl("gangwon-chuncheon", "notes", "32010")).toContain(
      "/ko/learn/dong/32010/",
    );
    // 코드를 못 주면 한 단계 위로 보낸다. 아무 데도 안 보내는 것보다 낫다.
    expect(atlasLearnUrl("gangwon-chuncheon", "notes")).toContain("/ko/learn/sigun/gangwon/");
  });

  it("모든 읍면동 코스에 시군구 코드가 있다", () => {
    // 이 코드가 곧 저쪽 주소다. 하나라도 비면 그 코스만 조용히 한 단계 위로 샌다.
    const dong = COURSES.filter((c) => c.level === "dong");
    expect(dong.length).toBeGreaterThan(200);
    expect(dong.filter((c) => !c.geo?.prefix)).toEqual([]);
  });

  it("어디서 넘어왔는지를 싣는다", () => {
    expect(atlasLearnUrl("seoul", "notes")).toContain("utm_medium=notes");
  });
});

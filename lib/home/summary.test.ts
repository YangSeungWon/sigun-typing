import { describe, expect, it } from "vitest";
import { buildHomeSeed } from "./summary";
import { COURSES } from "@/data/courses";

const seed = buildHomeSeed(Date.parse("2026-08-13T03:00:00Z"));

describe("첫 화면 씨앗", () => {
  it("245곳이다 — 시도 17 + 시군구 228", () => {
    expect(seed.totalRegions).toBe(245);
    expect(seed.courses).toHaveLength(17);
  });

  it("지역 배열을 들고 가지 않는다", () => {
    // 클라이언트로 내려가는 값이다. 245개 지역 객체가 따라오면 안 된다.
    for (const c of seed.courses) {
      expect(Object.keys(c).sort()).toEqual(["id", "name", "sido", "total", "version"]);
    }
  });

  it("시도 코드는 geo.prefix가 아니라 지역 코드 앞 두 자리다", () => {
    /*
     * 이 테스트가 이 파일의 존재 이유다. 전남의 geo.prefix는 "36"인데
     * 그건 세종의 시도 코드다 — 그대로 쓰면 전남 진행률이 세종 자리에 찍힌다.
     */
    const jeonnam = COURSES.find((c) => c.id === "jeonnam")!;
    expect(jeonnam.geo?.prefix).toBe("36");
    expect(seed.courses.find((c) => c.id === "jeonnam")!.sido).toBe("46");

    const sejong = seed.sido.find((s) => s.name === "세종")!;
    expect(sejong.code).toBe("36");
    expect(sejong.courseId).toBeUndefined();
  });

  it("시도는 열일곱 줄이고 세종만 코스가 없다", () => {
    expect(seed.sido).toHaveLength(17);
    const 코스없음 = seed.sido.filter((s) => !s.courseId);
    expect(코스없음.map((s) => s.name)).toEqual(["세종"]);
  });

  it("시도마다 코스는 많아야 하나다", () => {
    const ids = seed.sido.map((s) => s.courseId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("시도별 지역 수를 다 더하면 228이다", () => {
    // 245 - 17(전국 코스). 어느 시군 코스도 빠지지 않았다는 뜻이다.
    expect(seed.sido.reduce((sum, s) => sum + s.total, 0)).toBe(228);
  });

  it("오늘의 도전은 실재하는 코스다", () => {
    expect(seed.courses.map((c) => c.id)).toContain(seed.today.courseId);
    expect(seed.today.dateKey).toBe("2026-08-13");
  });
});

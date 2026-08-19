import { describe, expect, it } from "vitest";
import { renderGrid, shareText, type CourseGrid } from "./grid";
import { fitsTweet, tweetWeight } from "./x";
import type { ItemResult } from "@/lib/game/types";
import GRIDS from "@/data/emoji-grid.json";
import { COURSES } from "@/data/courses";

function result(id: string, over: Partial<ItemResult> = {}): ItemResult {
  return {
    id,
    answer: id,
    elapsedMs: 1000,
    keystrokes: 3,
    errors: 0,
    attempts: 1,
    skipped: false,
    hinted: false,
    ...over,
  };
}

/** 2×2 격자 — 오른쪽 아래는 빈 칸. */
const GRID: CourseGrid = { cols: 2, rows: 2, cells: ["a", "b", "c", null] };

describe("이모지 격자", () => {
  it("빈 칸은 배경이고 나머지는 상태로 칠한다", () => {
    const out = renderGrid(GRID, [
      result("a"),
      result("b", { hinted: true }),
      result("c", { skipped: true }),
    ]);
    expect(out).toBe("🟩🟨\n🟥⬜");
  });

  it("헤맨 것은 힌트든 오답이든 같은 색이다", () => {
    // 초성을 본 것과 한 번 틀리고 고쳐 맞힌 것은 둘 다 "바로 안 떠올랐다"다.
    // 이모지는 코드유닛 둘이라 [0]으로 자르면 반쪽이 나온다.
    const first = (s: string) => [...s][0];
    expect(first(renderGrid(GRID, [result("a", { hinted: true })]))).toBe("🟨");
    expect(first(renderGrid(GRID, [result("a", { errors: 1, attempts: 2 })]))).toBe("🟨");
  });

  it("판을 도중에 접어 결과가 없는 지역은 못 맞힌 것이다", () => {
    // 결과 배열에 아예 없는 경우다. 빈 칸(⬜)과 헷갈리면 안 된다.
    expect(renderGrid(GRID, [result("a")])).toBe("🟩🟥\n🟥⬜");
  });

  it("격자가 없는 코스는 숫자만 나간다", () => {
    const t = shareText({
      courseName: "서울 25개 구",
      grid: null,
      results: [],
      completed: 25,
      total: 25,
      elapsedMs: 41_080,
      hintsUsed: 0,
    });
    expect(t).toContain("서울 25개 구 41.08초");
    expect(t).toContain("25곳 전부");
    expect(t).not.toContain("🟩");
  });

  it("힌트를 안 봤으면 힌트 줄이 없다", () => {
    const t = shareText({
      courseName: "제주 2 행정시",
      grid: null,
      results: [],
      completed: 2,
      total: 2,
      elapsedMs: 5_000,
      hintsUsed: 0,
    });
    expect(t).not.toContain("힌트");
  });

  it("가운데점을 쓰지 않는다", () => {
    // 값을 `·`로 잇는 것은 대시보드 문법이다. 채팅방에서는 잡음으로 읽힌다.
    const t = shareText({
      courseName: "서울 25개 구",
      grid: GRID,
      results: [result("a"), result("b", { hinted: true }), result("c", { skipped: true })],
      completed: 24,
      total: 25,
      elapsedMs: 41_080,
      hintsUsed: 3,
    });
    expect(t).not.toContain("·");
    expect(t).toContain("25곳 중 24곳");
    expect(t).toContain("힌트 3번");
    expect(t.trimEnd().endsWith("같이 한 판?")).toBe(true);
  });

  it("1분이 넘으면 분으로 말한다", () => {
    const t = shareText({
      courseName: "경기도 31 시군",
      grid: null,
      results: [],
      completed: 31,
      total: 31,
      elapsedMs: 72_440,
      hintsUsed: 0,
    });
    expect(t).toContain("경기도 31 시군 1분 12.44초");
  });
});

describe("구운 자리표", () => {
  const grids = GRIDS as Record<string, CourseGrid>;

  it("모든 코스가 자리표를 갖는다", () => {
    // 빠지면 그 코스만 조용히 숫자 공유로 떨어진다 — 눈치채기 어렵다.
    const missing = COURSES.filter((c) => !grids[c.id]).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it("칸 수가 지역 수와 정확히 같다", () => {
    for (const course of COURSES) {
      const g = grids[course.id];
      const placed = g.cells.filter(Boolean).length;
      expect(placed, `${course.id}`).toBe(course.regions.length);
    }
  });

  it("같은 지역이 두 칸을 차지하지 않는다", () => {
    for (const course of COURSES) {
      const codes = grids[course.id].cells.filter(Boolean);
      expect(new Set(codes).size, `${course.id}`).toBe(codes.length);
    }
  });

  /**
   * 먼바다 지역은 빌드 스크립트가 이름으로 골라 떼어 놓는다(OFFSHORE).
   * 코드가 바뀌면 조용히 육지에 붙어 버리므로 여기서 잡는다.
   */
  it("먼바다 지역은 육지와 대각선으로도 닿지 않는다", () => {
    const cases: [course: string, offshore: string[]][] = [
      ["sido", ["50"]],
      ["incheon", ["28720"]],
      ["gyeongbuk", ["47940"]],
      ["nationwide", ["28720", "47940", "50110", "50130"]],
    ];
    for (const [courseId, codes] of cases) {
      const g = grids[courseId];
      const at = new Map<string, [number, number]>();
      g.cells.forEach((c, i) => {
        if (c) at.set(c, [i % g.cols, Math.floor(i / g.cols)]);
      });
      const island = new Set(codes);
      for (const code of codes) {
        const seat = at.get(code);
        expect(seat, `${courseId}의 ${code}`).toBeDefined();
        for (const [other, o] of at) {
          if (island.has(other)) continue;
          const touching =
            Math.abs(o[0] - seat![0]) <= 1 && Math.abs(o[1] - seat![1]) <= 1;
          expect(touching, `${courseId}: ${code}가 ${other}에 붙었다`).toBe(false);
        }
      }
    }
  });

  it("제주 코스는 통째로 섬이라 떼어 낼 것이 없다", () => {
    // 제주시·서귀포시 둘 다 먼바다 목록에 있지만, 여기서는 그 둘이 전부다.
    // 떼어 내면 남는 육지가 없어 격자가 사라진다.
    const g = grids.jeju;
    expect(g.cells.filter(Boolean)).toHaveLength(2);
    expect(g.rows).toBe(1);
  });

  it("cells 길이가 cols×rows다", () => {
    for (const course of COURSES) {
      const g = grids[course.id];
      expect(g.cells.length, `${course.id}`).toBe(g.cols * g.rows);
    }
  });
});

describe("X로 보내기", () => {
  const grids = GRIDS as Record<string, CourseGrid>;

  const body = (courseId: string, courseName: string, withGrid: boolean) => {
    const course = COURSES.find((c) => c.id === courseId)!;
    return shareText({
      courseName,
      grid: withGrid ? grids[courseId] : null,
      results: course.regions.map((r) => result(r.code)),
      completed: course.regions.length,
      total: course.regions.length,
      elapsedMs: 41_080,
      hintsUsed: 0,
    });
  };

  it("한글은 2로, 라틴은 1로 센다", () => {
    // length로 재면 한글이 1로 세어져 실제 무게보다 한참 작게 나온다.
    expect(tweetWeight("abc")).toBe(3);
    expect(tweetWeight("가나다")).toBe(6);
    expect(tweetWeight("🟩")).toBe(2);
  });

  it("서울은 격자를 실은 채로 들어간다", () => {
    expect(fitsTweet(body("seoul", "서울 25개 구", true))).toBe(true);
  });

  it("전국은 격자를 실으면 못 들어간다", () => {
    // 19×19 격자만으로 741이다. 자르지 않고 격자를 뺀다.
    expect(fitsTweet(body("nationwide", "전국 229 시군구", true))).toBe(false);
    expect(fitsTweet(body("nationwide", "전국 229 시군구", false))).toBe(true);
  });
});

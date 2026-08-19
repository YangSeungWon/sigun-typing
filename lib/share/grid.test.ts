import { describe, expect, it } from "vitest";
import { renderGrid, shareText, type CourseGrid } from "./grid";
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
      time: "00:41.08",
      hintsUsed: 0,
    });
    expect(t).toContain("25/25 · 00:41.08");
    expect(t).not.toContain("🟩");
  });

  it("힌트를 안 봤으면 힌트 칸을 적지 않는다", () => {
    const t = shareText({
      courseName: "제주 2 행정시",
      grid: null,
      results: [],
      completed: 2,
      total: 2,
      time: "00:05.00",
      hintsUsed: 0,
    });
    expect(t).not.toContain("힌트");
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

  it("cells 길이가 cols×rows다", () => {
    for (const course of COURSES) {
      const g = grids[course.id];
      expect(g.cells.length, `${course.id}`).toBe(g.cols * g.rows);
    }
  });
});

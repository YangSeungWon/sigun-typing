import { describe, expect, it } from "vitest";
import { COURSES } from "../courses";
import { hasCourseGeo } from "../../lib/geo";
import type { CourseGeo } from "./types";

/**
 * 산출물을 자동으로 모은다. 코스를 추가할 때 이 파일을 손대지 않아도
 * 새 코스가 아래 모든 검사에 자동으로 포함된다.
 */
const GEO: Record<string, CourseGeo> = Object.fromEntries(
  Object.entries(
    import.meta.glob("./*.json", { eager: true }) as Record<
      string,
      { default: CourseGeo }
    >,
  ).map(([path, mod]) => [path.replace(/^\.\/|\.json$/g, ""), mod.default]),
);
const WITH_GEO = COURSES.filter((c) => c.geo);

describe("지도 데이터", () => {
  it("지도를 선언한 코스는 모두 런타임에서 불러올 수 있다", () => {
    // lib/geo.ts의 목록에 한 줄 빠뜨리면 지도 없이 조용히 돌아간다.
    for (const course of WITH_GEO) {
      expect(hasCourseGeo(course.id), `${course.id} 로더 없음`).toBe(true);
      expect(GEO[course.id], `${course.id} 산출물 없음`).toBeDefined();
    }
  });

  it.each(WITH_GEO)("$name — 모든 지역에 경계가 있다", (course) => {
    const geo = GEO[course.id];
    const shapes = new Map(geo.regions.map((r) => [r.code, r]));
    for (const region of course.regions) {
      const shape = shapes.get(region.code);
      expect(shape, `${region.name} 경계 없음`).toBeDefined();
      expect(shape!.name).toBe(region.name);
      // 병합에 실패하면 path가 비거나 조각만 남는다.
      expect(shape!.d.length).toBeGreaterThan(50);
    }
  });

  it.each(WITH_GEO)("$name — 코스와 지역 수가 같다", (course) => {
    expect(GEO[course.id].regions).toHaveLength(course.regions.length);
  });

  it.each(WITH_GEO)("$name — 남는 경계가 없다", (course) => {
    const codes = new Set(course.regions.map((r) => r.code));
    for (const shape of GEO[course.id].regions) {
      expect(codes.has(shape.code), `${shape.name}은 코스에 없다`).toBe(true);
    }
  });

  it.each(WITH_GEO)("$name — 라벨 위치가 뷰박스 안에 있다", (course) => {
    const geo = GEO[course.id];
    for (const r of geo.regions) {
      expect(r.cx, r.name).toBeGreaterThanOrEqual(0);
      expect(r.cx, r.name).toBeLessThanOrEqual(geo.width);
      expect(r.cy, r.name).toBeGreaterThanOrEqual(0);
      expect(r.cy, r.name).toBeLessThanOrEqual(geo.height);
    }
  });

  /**
   * 진짜로 지켜야 하는 성질. 무게중심을 쓰면 오목한 해안 시군이나 섬을 안은
   * 지역에서 라벨이 도형 바깥 바다에 찍힌다.
   */
  it.each(WITH_GEO)("$name — 라벨이 자기 도형 안에 있다", (course) => {
    for (const r of GEO[course.id].regions) {
      expect(pointInPath(r.cx, r.cy, r.d), `${r.name} 라벨이 도형 밖`).toBe(true);
    }
  });
});

/** geoPath가 다각형에 내놓는 경로는 M/L/Z만 쓰므로 그대로 링으로 되돌릴 수 있다. */
function parseRings(d: string): [number, number][][] {
  expect(d, "예상치 못한 경로 명령").not.toMatch(/[CSQTAHVcsqtahv]/);
  return d
    .split("Z")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) =>
      chunk
        .replace(/^M/, "")
        .split("L")
        .map((pair) => pair.split(",").map(Number) as [number, number]),
    );
}

function pointInPath(x: number, y: number, d: string): boolean {
  let inside = false;
  for (const ring of parseRings(d)) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * 이름이 겹치는 지역이 다른 도시에서 새어 들어오지 않는지.
 * 접두사로 원본을 먼저 자른 뒤에 이름을 맞추는 순서가 지켜져야만 통과한다.
 */
describe("중복 지명", () => {
  const shapeOf = (courseId: string, name: string) =>
    GEO[courseId].regions.find((r) => r.name === name);

  /** 여섯 도시에 같은 이름이 있으므로, 하나라도 새어 들어오면 여기서 걸린다. */
  it.each(["중구", "동구", "서구", "남구", "북구"])(
    "%s를 가진 도시들이 서로 다른 경계를 쓴다",
    (name) => {
      const owners = Object.keys(GEO).filter((id) => shapeOf(id, name));
      expect(owners.length, `${name}를 가진 코스가 없다`).toBeGreaterThan(1);
      const paths = owners.map((id) => shapeOf(id, name)!.d);
      expect(new Set(paths).size, `${name} 경계가 도시 간에 겹친다`).toBe(paths.length);
    },
  );

  it("인천 미추홀구는 원본의 옛 이름(남구)으로 경계를 찾는다", () => {
    const michuhol = shapeOf("incheon", "미추홀");
    expect(michuhol, "미추홀 경계 없음").toBeDefined();
    // 같은 인천의 남동구와 섞이지 않아야 한다.
    expect(michuhol!.d).not.toBe(shapeOf("incheon", "남동")!.d);
  });

  it("서울과 부산에 모두 있는 강서구가 서로 다른 경계를 가진다", () => {
    const seoulGangseo = shapeOf("seoul", "강서");
    const busanGangseo = shapeOf("busan", "강서");
    expect(seoulGangseo).toBeDefined();
    expect(busanGangseo).toBeDefined();
    expect(busanGangseo!.d).not.toBe(seoulGangseo!.d);
  });

  it("부산 기장군도 구와 같은 방식으로 처리된다", () => {
    const gijang = shapeOf("busan", "기장");
    expect(gijang).toBeDefined();
    expect(gijang!.d.length).toBeGreaterThan(50);
  });

  it("한 코스 안에서 같은 경계가 두 지역에 쓰이지 않는다", () => {
    for (const [id, geo] of Object.entries(GEO)) {
      const paths = geo.regions.map((r) => r.d);
      expect(new Set(paths).size, `${id}에 중복된 경계`).toBe(paths.length);
    }
  });
});

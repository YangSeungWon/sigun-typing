import { describe, expect, it } from "vitest";
import { COURSES } from "./index";
import reference from "../reference/administrative-codes.json";
import { PINNED_CODES, PINNED_COURSES } from "../reference/pinned-2025";

/**
 * 지역 코드 검사.
 *
 * 세 가지를 구분해서 본다.
 *  · Integrity   — 코드가 실수로 바뀌지 않았는가 (스냅샷)
 *  · Consistency — 지금 데이터끼리 모순되지 않는가 (형식·접두사·코드↔이름)
 *  · Validity    — 실제 행정코드가 맞는가 (공식 자료와 대조)
 *
 * Validity 검사는 2026년에 수집한 공식 자료를 쓰지만, 이 게임은 경계 자료에
 * 맞춰 2025년 기준으로 고정되어 있다. 그래서 그 사이 개편된 지역은
 * data/reference/pinned-2025.ts 의 예외 목록으로 빠진다 — 통과했다고 해서
 * 모든 코드가 현행 공식 코드라는 뜻은 아니다.
 */

const sigunguCourses = COURSES.filter((c) => c.geo?.file === "municipalities");
const sidoCourses = COURSES.filter((c) => c.geo?.file === "provinces");

describe("형식 (consistency)", () => {
  it.each(sigunguCourses)("$name — 시군구 코드는 5자리 숫자", (course) => {
    for (const r of course.regions) {
      expect(r.code, `${r.name}`).toMatch(/^\d{5}$/);
    }
  });

  it.each(sidoCourses)("$name — 시도 코드는 2자리 숫자", (course) => {
    for (const r of course.regions) {
      expect(r.code, `${r.name}`).toMatch(/^\d{2}$/);
    }
  });
});

describe("접두사 일관성 (consistency)", () => {
  it.each(sigunguCourses)("$name — 한 코스의 코드는 같은 시도에 속한다", (course) => {
    // 다른 도의 코드를 잘못 붙여 넣으면 여기서 걸린다.
    const prefixes = new Set(course.regions.map((r) => r.code.slice(0, 2)));
    expect([...prefixes], `${course.name}에 섞인 시도 접두사`).toHaveLength(1);
  });
});

describe("코드와 표준 표기 (consistency)", () => {
  /**
   * 전역 유일성보다 오래가는 불변식이다. 나중에 한 지역이 여러 코스에
   * 들어가더라도, 같은 코드가 다른 이름을 가리키는 일만 없으면 된다.
   */
  it("같은 코드는 언제나 같은 표준 표기를 가리킨다", () => {
    const byCode = new Map<string, { name: string; course: string }>();
    for (const course of COURSES) {
      for (const r of course.regions) {
        const seen = byCode.get(r.code);
        if (seen && seen.name !== r.name) {
          throw new Error(
            `코드 ${r.code}가 '${seen.name}'(${seen.course})과 '${r.name}'(${course.id}) 둘을 가리킵니다`,
          );
        }
        byCode.set(r.code, { name: r.name, course: course.id });
      }
    }
    expect(byCode.size).toBeGreaterThan(0);
  });

  it.each(COURSES)("$name — 코스 안에서 코드가 중복되지 않는다", (course) => {
    const codes = course.regions.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("공식 자료 대조 (validity)", () => {
  const sigungu = reference.sigungu as Record<string, string>;
  const sido = reference.sido as Record<string, string>;

  it.each(sigunguCourses.filter((c) => !PINNED_COURSES.includes(c.id)))(
    "$name — 코드가 공식 자료에 있고 이름이 맞는다",
    (course) => {
      for (const r of course.regions) {
        if (PINNED_CODES.has(r.code)) continue;
        const official = sigungu[r.code];
        expect(official, `${r.name}(${r.code}) 공식 자료에 없음`).toBeDefined();
        // 공식 명칭은 "경기도 수원시"처럼 시도가 앞에 붙는다.
        const accepted = [r.name, ...(r.aliases ?? [])];
        expect(
          accepted.some((a) => official!.endsWith(a)),
          `${r.code} 공식 "${official}" ↔ 코스 "${accepted.join("/")}"`,
        ).toBe(true);
      }
    },
  );

  it.each(sidoCourses)("$name — 시도 코드가 공식 자료와 맞는다", (course) => {
    for (const r of course.regions) {
      if (PINNED_CODES.has(r.code)) continue;
      const official = sido[r.code];
      expect(official, `${r.name}(${r.code}) 공식 자료에 없음`).toBeDefined();
      const accepted = [r.name, ...(r.aliases ?? [])];
      expect(
        accepted.includes(official!),
        `${r.code} 공식 "${official}" ↔ 코스 "${accepted.join("/")}"`,
      ).toBe(true);
    }
  });

  it("2025년으로 고정한 예외가 실제로 공식 자료에 없다", () => {
    // 개편이 되돌려지거나 자료가 갱신되면 예외를 지워야 한다는 신호가 된다.
    for (const code of PINNED_CODES) {
      const found = code.length === 2 ? sido[code] : sigungu[code];
      expect(found, `${code}는 이제 공식 자료에 있으니 예외에서 빼세요`).toBeUndefined();
    }
  });
});

/**
 * 공식 코드임을 증명하는 장치가 아니다.
 * 리팩터링이나 복붙 과정에서 어제 있던 값이 오늘 우연히 바뀌지 않았음만 보장한다.
 * 의도한 변경이면 `npx vitest -u` 로 갱신한다.
 */
describe("스냅샷 (integrity)", () => {
  it("지역 코드가 의도치 않게 바뀌지 않았다", () => {
    const snapshot = COURSES.map((c) => ({
      course: c.id,
      regions: c.regions.map((r) => `${r.code} ${r.name}`),
    }));
    expect(snapshot).toMatchSnapshot();
  });
});

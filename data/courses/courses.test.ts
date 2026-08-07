import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  busan,
  COURSES,
  daegu,
  daejeon,
  gwangju,
  incheon,
  ulsan,
  gangwon,
  getCourse,
  gyeonggi,
  seoul,
  sidoCourse,
} from "./index";
import { isSyllable } from "../../lib/hangul/jamo";
import { COURSE_GROUPS } from "../groups";

describe("코스 데이터 무결성", () => {
  it("코스 id는 중복되지 않는다", () => {
    const ids = COURSES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(COURSES)("$name — 지역이 중복되지 않는다", (course) => {
    const codes = course.regions.map((r) => r.code);
    const names = course.regions.map((r) => r.name);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(COURSES)("$name — 이름은 한글 음절로만 이루어진다", (course) => {
    for (const r of course.regions) {
      expect([...r.name].every(isSyllable), `${r.name}`).toBe(true);
    }
  });

  it.each(COURSES)("$name — 별칭이 표준 표기와 겹치지 않는다", (course) => {
    for (const r of course.regions) {
      expect(r.aliases ?? []).not.toContain(r.name);
    }
  });

  it("행정구역 수가 실제와 맞는다", () => {
    expect(sidoCourse.regions).toHaveLength(17);
    expect(seoul.regions).toHaveLength(25);
    expect(gyeonggi.regions).toHaveLength(31);
    expect(gangwon.regions).toHaveLength(18);
    expect(busan.regions).toHaveLength(16); // 15구 + 기장군
    expect(incheon.regions).toHaveLength(10); // 8구 + 강화·옹진군
    expect(daegu.regions).toHaveLength(9); // 7구 + 달성·군위군
    expect(gwangju.regions).toHaveLength(5);
    expect(daejeon.regions).toHaveLength(5);
    expect(ulsan.regions).toHaveLength(5); // 4구 + 울주군
  });

  it("미추홀구는 옛 이름도 정답으로 받는다", () => {
    const michuhol = incheon.regions.find((r) => r.name === "미추홀");
    expect(michuhol).toBeDefined();
    expect(michuhol!.aliases).toEqual(expect.arrayContaining(["미추홀구", "남구"]));
  });

  it("코스마다 원본 접두사가 서로 다르다", () => {
    // 같은 접두사를 두 코스가 쓰면 한쪽이 남의 경계를 가져간다.
    const prefixes = COURSES.filter((c) => c.geo?.prefix).map((c) => c.geo!.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("부산은 접미사를 뗄 수 없는 이름을 그대로 표준 표기로 쓴다", () => {
    const named = (n: string) => busan.regions.find((r) => r.name === n);
    for (const n of ["중구", "동구", "서구", "남구", "북구"]) {
      expect(named(n), `${n} 없음`).toBeDefined();
      // 이런 이름은 별칭이 따로 필요 없다 — 표준 표기가 곧 정식 명칭이다.
      expect(named(n)!.aliases ?? []).toHaveLength(0);
    }
  });

  it("부산 기장군은 구와 같은 Place 모델을 쓴다", () => {
    const gijang = busan.regions.find((r) => r.name === "기장");
    expect(gijang).toBeDefined();
    expect(gijang!.aliases).toContain("기장군");
  });

  it("서울과 부산이 같은 이름을 각자 가진다", () => {
    const seoulNames = new Set(seoul.regions.map((r) => r.name));
    const busanNames = new Set(busan.regions.map((r) => r.name));
    // 겹치는 이름이 실제로 있어야 이 검증이 의미가 있다.
    const shared = [...seoulNames].filter((n) => busanNames.has(n));
    expect(shared.length, "겹치는 이름이 없으면 회귀 테스트가 무의미하다").toBeGreaterThan(0);
    expect(shared).toContain("강서");
  });

  it.each(COURSES)("$name — 지도를 선언했으면 원본과 범위가 함께 적혀 있다", (course) => {
    if (!course.geo) return;
    expect(course.geo.file).toMatch(/^(provinces|municipalities)$/);
    // 전국 지도 말고는 접두사로 범위를 좁혀야 한다. `중구`는 여섯 도시에 있다.
    if (course.geo.file === "municipalities") {
      expect(course.geo.prefix, course.name).toBeTruthy();
    }
  });

  it.each(COURSES)("$name — 별칭에 원본의 정식 명칭이 들어 있다", (course) => {
    // 이게 빠지면 지도 매칭이 조용히 실패한다.
    for (const r of course.regions) {
      const candidates = [r.name, ...(r.aliases ?? [])];
      expect(candidates.length, `${r.name} 후보 없음`).toBeGreaterThan(0);
      expect(new Set(candidates).size, `${r.name} 별칭 중복`).toBe(candidates.length);
    }
  });

  it("getCourse는 id로 코스를 찾고, 없으면 undefined", () => {
    expect(getCourse("gyeonggi")).toBe(gyeonggi);
    expect(getCourse("없는코스")).toBeUndefined();
  });
});

describe("코스 그룹", () => {
  it("모든 코스가 알려진 권역에 속한다", () => {
    const known = new Set(COURSE_GROUPS.map((g) => g.id));
    for (const c of COURSES) {
      expect(known.has(c.group), `${c.name} → ${c.group}`).toBe(true);
    }
  });

  it("권역 id는 중복되지 않는다", () => {
    const ids = COURSE_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("전국 코스만 상위 행정구역이 없다", () => {
    for (const c of COURSES) {
      if (c.group === "nationwide") expect(c.parentName).toBeUndefined();
      else expect(c.parentName, c.name).toBeTruthy();
    }
  });
});

describe("코스 판번호", () => {
  /**
   * 기록끼리 비교할 수 있는지는 `courseId · courseVersion · scoringVersion`이
   * 정한다. 그런데 지금까지 판번호를 올리는 일은 순전히 사람 기억에 맡겨져
   * 있었다 — 지역 하나를 조용히 고치면, 총 타수가 달라진 코스의 기록이
   * 옛 기록과 같은 순위표에 섞인다.
   *
   * 여기서 판정에 영향을 주는 것만 골라 지문을 뜬다. 코스 설명이나 지도
   * 색을 고쳤다고 이 테스트가 울면 안 되기 때문이다.
   */
  function fingerprint(course: (typeof COURSES)[number]): string {
    const content = course.regions
      .map((r) => [r.code, r.name, ...(r.aliases ?? [])].join("|"))
      .join("\n");
    return createHash("sha1").update(content).digest("hex").slice(0, 12);
  }

  it("내용이 바뀌면 판번호도 바뀌어야 한다", () => {
    /*
     * 이 스냅샷이 깨졌다면 둘 중 하나다.
     *
     *   · 지역·순서·별칭을 고쳤다 → data/types.ts의 규칙대로 version을 올리고,
     *     그 다음에 `npx vitest -u`로 스냅샷을 갱신한다.
     *   · version만 올렸다 → 키가 바뀐 것이므로 그대로 갱신하면 된다.
     *
     * 지문만 바뀌고 판번호가 그대로인 채로 갱신하지 말 것. 그 순간 옛 기록과
     * 새 기록이 같은 순위표에서 비교된다.
     */
    const fingerprints = Object.fromEntries(
      COURSES.map((c) => [`${c.id}@v${c.version}`, fingerprint(c)]),
    );
    expect(fingerprints).toMatchSnapshot();
  });
});

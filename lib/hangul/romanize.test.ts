import { describe, expect, it } from "vitest";
import { COURSES } from "../../data/courses";
import { romanize, romanizeRegion } from "./romanize";

/**
 * 표지판에 적히는 글자라 틀리면 그대로 사람들이 본다. 소리 변화가 실제로
 * 일어나는 지명을 골라 못 박아 둔다 — 이 목록이 이 파일의 존재 이유다.
 */
describe("로마자 표기", () => {
  it.each([
    ["서울", "Seoul"],
    ["부산", "Busan"],
    ["대구", "Daegu"],
    ["인천", "Incheon"],
    ["광주", "Gwangju"],
    ["대전", "Daejeon"],
    ["울산", "Ulsan"],
    ["세종", "Sejong"],
    ["경기", "Gyeonggi"],
    ["강원", "Gangwon"],
    ["충북", "Chungbuk"],
    ["충남", "Chungnam"],
    ["전북", "Jeonbuk"],
    ["전남", "Jeonnam"],
    ["경북", "Gyeongbuk"],
    ["경남", "Gyeongnam"],
    ["제주", "Jeju"],
  ])("시도 %s → %s", (korean, expected) => {
    expect(romanize(korean)).toBe(expected);
  });

  it.each([
    // ㅇ 뒤의 ㄹ이 ㄴ으로 — 글자대로 옮기면 Gangreung이 된다
    ["강릉", "Gangneung"],
    // ㄹ + ㄹ
    ["울릉", "Ulleung"],
    // 받침 ㄹ이 모음 앞으로 넘어가 r이 된다 — Cheolwon이 아니다
    ["철원", "Cheorwon"],
    ["밀양", "Miryang"],
    // 연음 일반
    ["단양", "Danyang"],
    ["진안", "Jinan"],
    ["정읍", "Jeongeup"],
    // 받침이 자음 앞에서 소리대로
    ["옥천", "Okcheon"],
    ["합천", "Hapcheon"],
    ["태백", "Taebaek"],
    ["목포", "Mokpo"],
    // 복합 모음
    ["의성", "Uiseong"],
    ["괴산", "Goesan"],
    ["횡성", "Hoengseong"],
    ["과천", "Gwacheon"],
  ])("소리 변화 %s → %s", (korean, expected) => {
    expect(romanize(korean)).toBe(expected);
  });

  it.each([
    // 실제 표지판은 행정구역 단위 앞에 붙임표를 넣는다.
    ["중구", "구", "Jung-gu"],
    ["북구", "구·군", "Buk-gu"],
    ["서구", "구", "Seo-gu"],
    // 단위처럼 보이지만 이름의 일부인 경우. 전국 코스가 세는 단위가 아니다.
    ["대구", "시도", "Daegu"],
    ["군위", "구·군", "Gunwi"],
    ["수원", "시군", "Suwon"],
  ])("행정구역 단위 %s(%s) → %s", (name, unit, expected) => {
    expect(romanizeRegion(name, unit)).toBe(expected);
  });

  /**
   * 빈 문자열이나 한글이 섞여 남은 결과가 나오면 표지판에 그대로 찍힌다.
   *
   * 행정동은 이름에 숫자가 들어서(`창신1동`) 글자만으로는 규칙이 하나로
   * 서지 않는다. 표지판은 그 숫자를 띄어 적으므로(`Changsin 1-dong`)
   * 허용하는 모양도 층에 따라 갈린다.
   */
  it("모든 코스의 지명이 로마자로 변환된다", () => {
    for (const course of COURSES) {
      const word = course.level === "dong" ? /^[A-Z][a-z]*( ?\d+)?[a-z]*$/ : /^[A-Z][a-z]+$/;
      const signed =
        course.level === "dong"
          ? /^[A-Z][a-z]*( ?\d+)?[a-z]*(-dong)?$/
          : /^[A-Z][a-z]+(-(si|gun|gu|do))?$/;
      for (const region of course.regions) {
        expect(romanize(region.name), region.name).toMatch(word);
        expect(romanizeRegion(region.name, course.placeUnit), region.name).toMatch(signed);
      }
    }
  });
});

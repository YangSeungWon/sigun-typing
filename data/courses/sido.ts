import type { Course, Region } from "../types";

/**
 * 전국 17개 시도. 가장 짧고 가장 쉬운 입문 코스.
 * 순서는 서울에서 시작해 대체로 북에서 남으로 내려가 제주에서 끝난다.
 */
const sido = (code: string, name: string, ...aliases: string[]): Region => ({
  code,
  name,
  aliases,
});

export const sidoCourse: Course = {
  id: "sido",
  name: "전국 17 시도",
  group: "nationwide",
  level: "sido",
  placeUnit: "시도",
  version: 1,
  geo: { file: "provinces", simplifyPercent: 4 },
  description: "서울에서 제주까지, 광역자치단체 열일곱 곳",
  regions: [
    sido("11", "서울", "서울시", "서울특별시"),
    sido("28", "인천", "인천시", "인천광역시"),
    sido("41", "경기", "경기도"),
    sido("51", "강원", "강원도", "강원특별자치도"),
    sido("43", "충북", "충청북도"),
    sido("44", "충남", "충청남도"),
    sido("30", "대전", "대전시", "대전광역시"),
    sido("36", "세종", "세종시", "세종특별자치시"),
    sido("52", "전북", "전라북도", "전북특별자치도"),
    sido("46", "전남", "전라남도"),
    sido("29", "광주", "광주시", "광주광역시"),
    sido("47", "경북", "경상북도"),
    sido("27", "대구", "대구시", "대구광역시"),
    sido("48", "경남", "경상남도"),
    sido("31", "울산", "울산시", "울산광역시"),
    sido("26", "부산", "부산시", "부산광역시"),
    sido("50", "제주", "제주도", "제주특별자치도"),
  ],
};

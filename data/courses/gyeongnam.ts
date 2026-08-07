import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 경상남도 18개 시군.
 *
 * 코드와 표준 표기는 행정표준코드관리시스템 법정동코드 자료에서 가져왔고,
 * 순서만 손으로 정했다 — 가나다순이 아니라 인접한 지역을 잇는 경로다.
 */
export const gyeongnam: Course = {
  id: "gyeongnam",
  name: "경남 18 시군",
  group: "yeongnam",
  parentName: "경상남도",
  placeUnit: "시군",
  version: 1,
  description: "북서 거창에서 남해안을 따라 하동까지",
  geo: { file: "municipalities", prefix: "38" },
  regions: [
    place("48880", "거창", "군"),
    place("48870", "함양", "군"),
    place("48860", "산청", "군"),
    place("48890", "합천", "군"),
    place("48740", "창녕", "군"),
    place("48270", "밀양", "시"),
    place("48330", "양산", "시"),
    place("48250", "김해", "시"),
    place("48120", "창원", "시"),
    place("48730", "함안", "군"),
    place("48720", "의령", "군"),
    place("48170", "진주", "시"),
    place("48240", "사천", "시"),
    place("48820", "고성", "군"),
    place("48220", "통영", "시"),
    place("48310", "거제", "시"),
    place("48840", "남해", "군"),
    place("48850", "하동", "군"),
  ],
};

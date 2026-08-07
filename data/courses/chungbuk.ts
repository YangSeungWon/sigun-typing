import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 충청북도 11개 시군.
 *
 * 코드와 표준 표기는 행정표준코드관리시스템 법정동코드 자료에서 가져왔고,
 * 순서만 손으로 정했다 — 가나다순이 아니라 인접한 지역을 잇는 경로다.
 */
export const chungbuk: Course = {
  id: "chungbuk",
  name: "충북 11 시군",
  group: "chungcheong",
  parentName: "충청북도",
  placeUnit: "시군",
  version: 1,
  description: "북동 단양에서 청주를 지나 남쪽 영동까지",
  geo: { file: "municipalities", prefix: "33" },
  regions: [
    place("43800", "단양", "군"),
    place("43150", "제천", "시"),
    place("43130", "충주", "시"),
    place("43770", "음성", "군"),
    place("43750", "진천", "군"),
    place("43745", "증평", "군"),
    place("43760", "괴산", "군"),
    place("43110", "청주", "시"),
    place("43720", "보은", "군"),
    place("43730", "옥천", "군"),
    place("43740", "영동", "군"),
  ],
};

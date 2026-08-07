import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 전북특별자치도 14개 시군.
 *
 * 코드와 표준 표기는 행정표준코드관리시스템 법정동코드 자료에서 가져왔고,
 * 순서만 손으로 정했다 — 가나다순이 아니라 인접한 지역을 잇는 경로다.
 */
export const jeonbuk: Course = {
  id: "jeonbuk",
  name: "전북 14 시군",
  group: "honam",
  parentName: "전북특별자치도",
  placeUnit: "시군",
  version: 1,
  description: "서해 군산에서 전주를 거쳐 동쪽 산간 장수까지",
  geo: { file: "municipalities", prefix: "35" },
  regions: [
    place("52130", "군산", "시"),
    place("52140", "익산", "시"),
    place("52710", "완주", "군"),
    place("52110", "전주", "시"),
    place("52210", "김제", "시"),
    place("52800", "부안", "군"),
    place("52790", "고창", "군"),
    place("52180", "정읍", "시"),
    place("52770", "순창", "군"),
    place("52190", "남원", "시"),
    place("52750", "임실", "군"),
    place("52720", "진안", "군"),
    place("52730", "무주", "군"),
    place("52740", "장수", "군"),
  ],
};

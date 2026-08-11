import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 제주특별자치도 2개 행정시.
 *
 * 코드와 표준 표기는 행정표준코드관리시스템 법정동코드 자료에서 가져왔고,
 * 순서만 손으로 정했다 — 가나다순이 아니라 인접한 지역을 잇는 경로다.
 */
export const jeju: Course = {
  id: "jeju",
  name: "제주 2 행정시",
  group: "jeju",
  parentName: "제주특별자치도",
  placeUnit: "행정시",
  version: 2,
  description: "한라산 북쪽 제주시와 남쪽 서귀포시",
  geo: { file: "municipalities", prefix: "39" },
  regions: [
    place("50110", "제주", "시"),
    place("50130", "서귀포", "시"),
  ],
};

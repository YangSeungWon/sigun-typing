import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 대구광역시 7개 구와 2개 군.
 *
 * 군위군은 2023년에 경상북도에서 편입됐고 다른 구·군과 떨어져 북쪽에 있다.
 * 지도가 그만큼 넓게 잡히지만 특수 처리는 하지 않는다 — 코스는 그저 장소 목록이다.
 */
export const daegu: Course = {
  id: "daegu",
  name: "대구 9개 구·군",
  group: "yeongnam",
  parentName: "대구광역시",
  placeUnit: "구·군",
  version: 2,
  description: "북쪽 군위에서 시내를 한 바퀴 돌아 남서쪽 달성까지",
  geo: { file: "municipalities", prefix: "22" },
  regions: [
    place("27720", "군위", "군"),
    place("27230", "북구"),
    place("27140", "동구"),
    place("27260", "수성", "구"),
    place("27200", "남구"),
    place("27110", "중구"),
    place("27170", "서구"),
    place("27290", "달서", "구"),
    place("27710", "달성", "군"),
  ],
};

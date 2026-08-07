import type { Course } from "../types";
import { place } from "./place.ts";

/** 대전광역시 5개 자치구. 북쪽 대덕에서 시계 방향으로 돈다. */
export const daejeon: Course = {
  id: "daejeon",
  name: "대전 5개 구",
  group: "chungcheong",
  parentName: "대전광역시",
  placeUnit: "구",
  version: 1,
  description: "북쪽 대덕에서 유성을 지나 동구까지",
  geo: { file: "municipalities", prefix: "25" },
  regions: [
    place("30230", "대덕", "구"),
    place("30200", "유성", "구"),
    place("30170", "서구"),
    place("30140", "중구"),
    place("30110", "동구"),
  ],
};

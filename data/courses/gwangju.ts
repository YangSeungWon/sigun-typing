import type { Course } from "../types";
import { place } from "./place.ts";

/** 광주광역시 5개 자치구. 서쪽 광산에서 시계 방향으로 돈다. */
export const gwangju: Course = {
  id: "gwangju",
  name: "광주 5개 구",
  group: "honam",
  parentName: "광주광역시",
  placeUnit: "구",
  version: 1,
  description: "서쪽 광산에서 시계 방향으로 다섯 곳",
  geo: { file: "municipalities", prefix: "24" },
  regions: [
    place("29200", "광산", "구"),
    place("29170", "북구"),
    place("29110", "동구"),
    place("29155", "남구"),
    place("29140", "서구"),
  ],
};

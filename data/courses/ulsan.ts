import type { Course } from "../types";
import { place } from "./place.ts";

/** 울산광역시 4개 구와 울주군. 넓은 울주를 먼저 지나 도심으로 들어온다. */
export const ulsan: Course = {
  id: "ulsan",
  name: "울산 5개 구·군",
  group: "yeongnam",
  parentName: "울산광역시",
  placeUnit: "구·군",
  version: 2,
  description: "울주를 크게 돌아 도심 네 곳으로",
  geo: { file: "municipalities", prefix: "26" },
  regions: [
    place("31710", "울주", "군"),
    place("31200", "북구"),
    place("31170", "동구"),
    place("31110", "중구"),
    place("31140", "남구"),
  ],
};

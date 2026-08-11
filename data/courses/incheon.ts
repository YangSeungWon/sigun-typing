import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 인천광역시 8개 구와 2개 군.
 *
 * 미추홀구는 2018년에 남구에서 이름이 바뀌었는데 원본 경계 자료에는 아직
 * `남구`로 남아 있다. 표준 표기는 지금 쓰는 이름으로 두고 옛 이름을 별칭으로
 * 받아, 데이터가 갱신되면 별칭만 지우면 되도록 했다.
 */
export const incheon: Course = {
  id: "incheon",
  name: "인천 10개 구·군",
  group: "capital",
  parentName: "인천광역시",
  placeUnit: "구·군",
  version: 2,
  description: "강화에서 내륙을 돌아 남쪽 바다 옹진까지",
  geo: { file: "municipalities", prefix: "23" },
  regions: [
    place("28710", "강화", "군"),
    place("28260", "서구"),
    place("28245", "계양", "구"),
    place("28237", "부평", "구"),
    place("28140", "동구"),
    place("28110", "중구"),
    place("28177", "미추홀", "구", ["남구"]),
    place("28200", "남동", "구"),
    place("28185", "연수", "구"),
    place("28720", "옹진", "군"),
  ],
};

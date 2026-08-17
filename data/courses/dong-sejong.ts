import type { Course } from "../types";

/*
 * 자동 생성 — 손대지 마세요. `npm run build:dong`이 다시 씁니다.
 *
 * 순서는 맞닿은 읍면동을 잇는 경로다(scripts/build-dong-courses.mts).
 * 어느 한 곳을 정성껏 손보고 싶으면 이 파일에서 떼어 자기 파일로 옮기세요 —
 * 생성기는 이미 코스가 있는 시군구를 건너뜁니다.
 */
export const dong_sejong: Course[] = [
  {
    id: "sejong",
    name: "세종특별자치시 24개 읍면동",
    group: "chungcheong",
    level: "dong",
    parentName: "세종특별자치시 세종특별자치시",
    placeUnit: "읍면동",
    version: 1,
    description: "소정면에서 고운동까지",
    geo: { file: "dong", prefix: "29010" },
    regions: [
    { code: "29010390", name: "소정면" },
    { code: "29010370", name: "전의면" },
    { code: "29010380", name: "전동면" },
    { code: "29010110", name: "조치원읍" },
    { code: "29010360", name: "연서면" },
    { code: "29010311", name: "연기면" },
    { code: "29010312", name: "연동면" },
    { code: "29010330", name: "부강면" },
    { code: "29010340", name: "금남면" },
    { code: "29010513", name: "반곡동" },
    { code: "29010710", name: "소담동" },
    { code: "29010660", name: "보람동" },
    { code: "29010640", name: "대평동" },
    { code: "29010522", name: "나성동" },
    { code: "29010610", name: "한솔동" },
    { code: "29010521", name: "새롬동" },
    { code: "29010350", name: "장군면" },
    { code: "29010680", name: "다정동" },
    { code: "29010515", name: "어진동" },
    { code: "29010514", name: "도담동" },
    { code: "29010512", name: "해밀동" },
    { code: "29010590", name: "아름동" },
    { code: "29010560", name: "종촌동" },
    { code: "29010600", name: "고운동" },
    ],
  },
];

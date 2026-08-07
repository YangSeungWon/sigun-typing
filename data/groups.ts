import type { CourseGroup } from "./types";

/** 코스 선택 화면의 권역 순서와 이름. 시도를 추가해도 여기만 손대면 된다. */
export const COURSE_GROUPS: { id: CourseGroup; name: string }[] = [
  { id: "nationwide", name: "전국" },
  { id: "capital", name: "수도권" },
  { id: "gangwon", name: "강원" },
  { id: "chungcheong", name: "충청" },
  { id: "honam", name: "호남" },
  { id: "yeongnam", name: "영남" },
  { id: "jeju", name: "제주" },
];

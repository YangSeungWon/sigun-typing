import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 충청남도 15개 시군.
 *
 * 코드와 표준 표기는 행정표준코드관리시스템 법정동코드 자료에서 가져왔고,
 * 순서만 손으로 정했다 — 가나다순이 아니라 인접한 지역을 잇는 경로다.
 */
export const chungnam: Course = {
  id: "chungnam",
  name: "충남 15 시군",
  group: "chungcheong",
  parentName: "충청남도",
  placeUnit: "시군",
  version: 2,
  description: "서해안 당진에서 내륙을 돌아 남쪽 서천까지",
  geo: { file: "municipalities", prefix: "34" },
  regions: [
    place("44270", "당진", "시"),
    place("44210", "서산", "시"),
    place("44825", "태안", "군"),
    place("44800", "홍성", "군"),
    place("44810", "예산", "군"),
    place("44200", "아산", "시"),
    place("44130", "천안", "시"),
    place("44150", "공주", "시"),
    place("44250", "계룡", "시"),
    place("44230", "논산", "시"),
    place("44710", "금산", "군"),
    place("44760", "부여", "군"),
    place("44790", "청양", "군"),
    place("44180", "보령", "시"),
    place("44770", "서천", "군"),
  ],
};

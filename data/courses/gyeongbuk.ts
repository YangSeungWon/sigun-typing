import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 경상북도 22개 시군.
 *
 * 코드와 표준 표기는 행정표준코드관리시스템 법정동코드 자료에서 가져왔고,
 * 순서만 손으로 정했다 — 가나다순이 아니라 인접한 지역을 잇는 경로다.
 */
export const gyeongbuk: Course = {
  id: "gyeongbuk",
  name: "경북 22 시군",
  group: "yeongnam",
  parentName: "경상북도",
  placeUnit: "시군",
  version: 1,
  description: "동해 울진에서 내륙을 크게 돌아 의성까지",
  geo: { file: "municipalities", prefix: "37" },
  regions: [
    place("47930", "울진", "군"),
    place("47920", "봉화", "군"),
    place("47210", "영주", "시"),
    place("47900", "예천", "군"),
    place("47280", "문경", "시"),
    place("47250", "상주", "시"),
    place("47150", "김천", "시"),
    place("47190", "구미", "시"),
    place("47850", "칠곡", "군"),
    place("47840", "성주", "군"),
    place("47830", "고령", "군"),
    place("47820", "청도", "군"),
    place("47290", "경산", "시"),
    place("47230", "영천", "시"),
    place("47130", "경주", "시"),
    place("47110", "포항", "시"),
    place("47940", "울릉", "군"),
    place("47770", "영덕", "군"),
    place("47750", "청송", "군"),
    place("47760", "영양", "군"),
    place("47170", "안동", "시"),
    place("47730", "의성", "군"),
  ],
};

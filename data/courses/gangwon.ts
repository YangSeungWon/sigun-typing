import type { Course } from "../types";
import { place } from "./place.ts";

/**
 * 강원특별자치도 18개 시군.
 *
 * 순서는 최북단 철원에서 휴전선을 따라 동쪽으로 간 뒤, 동해안을 따라
 * 남하하고, 백두대간 안쪽을 거쳐 서쪽 원주·춘천으로 돌아오는 경로다.
 */
export const gangwon: Course = {
  id: "gangwon",
  name: "강원 18 시군",
  group: "gangwon",
  level: "sigungu",
  parentName: "강원특별자치도",
  placeUnit: "시군",
  version: 2,
  geo: { file: "municipalities", prefix: "32" },
  description: "철원에서 휴전선을 따라 동해안으로, 다시 내륙을 돌아 춘천까지",
  regions: [
    place("51780", "철원", "군"),
    place("51790", "화천", "군"),
    place("51800", "양구", "군"),
    place("51810", "인제", "군"),
    place("51820", "고성", "군"),
    place("51210", "속초", "시"),
    place("51830", "양양", "군"),
    place("51150", "강릉", "시"),
    place("51170", "동해", "시"),
    place("51230", "삼척", "시"),
    place("51190", "태백", "시"),
    place("51770", "정선", "군"),
    place("51760", "평창", "군"),
    place("51750", "영월", "군"),
    place("51730", "횡성", "군"),
    place("51130", "원주", "시"),
    place("51720", "홍천", "군"),
    place("51110", "춘천", "시"),
  ],
};

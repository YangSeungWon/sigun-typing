import type { Course, Region } from "../types";

/**
 * 강원특별자치도 18개 시군.
 *
 * 순서는 최북단 철원에서 휴전선을 따라 동쪽으로 간 뒤, 동해안을 따라
 * 남하하고, 백두대간 안쪽을 거쳐 서쪽 원주·춘천으로 돌아오는 경로다.
 */
const sigun = (code: string, name: string, suffix: "시" | "군"): Region => ({
  code,
  name,
  aliases: [name + suffix],
});

export const gangwon: Course = {
  id: "gangwon",
  name: "강원 18 시군",
  group: "gangwon",
  parentName: "강원특별자치도",
  placeUnit: "시군",
  version: 1,
  geo: { file: "municipalities", prefix: "32" },
  description: "철원에서 휴전선을 따라 동해안으로, 다시 내륙을 돌아 춘천까지",
  regions: [
    sigun("51780", "철원", "군"),
    sigun("51790", "화천", "군"),
    sigun("51800", "양구", "군"),
    sigun("51810", "인제", "군"),
    sigun("51820", "고성", "군"),
    sigun("51210", "속초", "시"),
    sigun("51830", "양양", "군"),
    sigun("51150", "강릉", "시"),
    sigun("51170", "동해", "시"),
    sigun("51230", "삼척", "시"),
    sigun("51190", "태백", "시"),
    sigun("51770", "정선", "군"),
    sigun("51760", "평창", "군"),
    sigun("51750", "영월", "군"),
    sigun("51730", "횡성", "군"),
    sigun("51130", "원주", "시"),
    sigun("51720", "홍천", "군"),
    sigun("51110", "춘천", "시"),
  ],
};

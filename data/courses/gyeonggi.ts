import type { Course, Region } from "../types";

/**
 * 경기도 31개 시군.
 *
 * 순서는 가나다순이 아니라 북서 연천에서 시작해 인접 시군을 따라
 * 시계 반대 방향으로 훑고 남동 안성에서 끝나는 경로다.
 */
const sigun = (code: string, name: string, suffix: "시" | "군"): Region => ({
  code,
  name,
  aliases: [name + suffix],
});

export const gyeonggi: Course = {
  id: "gyeonggi",
  name: "경기도 31 시군",
  group: "capital",
  parentName: "경기도",
  placeUnit: "시군",
  version: 1,
  geo: { file: "municipalities", prefix: "31" },
  description: "북서 연천에서 남동 안성까지, 인접한 시군을 따라 한 바퀴",
  regions: [
    sigun("41800", "연천", "군"),
    sigun("41250", "동두천", "시"),
    sigun("41650", "포천", "시"),
    sigun("41820", "가평", "군"),
    sigun("41480", "파주", "시"),
    sigun("41630", "양주", "시"),
    sigun("41150", "의정부", "시"),
    sigun("41360", "남양주", "시"),
    sigun("41310", "구리", "시"),
    sigun("41280", "고양", "시"),
    sigun("41570", "김포", "시"),
    sigun("41190", "부천", "시"),
    sigun("41210", "광명", "시"),
    sigun("41390", "시흥", "시"),
    sigun("41270", "안산", "시"),
    sigun("41170", "안양", "시"),
    sigun("41410", "군포", "시"),
    sigun("41430", "의왕", "시"),
    sigun("41290", "과천", "시"),
    sigun("41130", "성남", "시"),
    sigun("41450", "하남", "시"),
    sigun("41610", "광주", "시"),
    sigun("41830", "양평", "군"),
    sigun("41670", "여주", "시"),
    sigun("41500", "이천", "시"),
    sigun("41460", "용인", "시"),
    sigun("41110", "수원", "시"),
    sigun("41590", "화성", "시"),
    sigun("41370", "오산", "시"),
    sigun("41220", "평택", "시"),
    sigun("41550", "안성", "시"),
  ],
};

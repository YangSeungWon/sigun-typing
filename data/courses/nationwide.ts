import type { Course } from "../types";
import { place } from "./place.ts";
import { seoul } from "./seoul.ts";
import { incheon } from "./incheon.ts";
import { gyeonggi } from "./gyeonggi.ts";
import { gangwon } from "./gangwon.ts";
import { chungbuk } from "./chungbuk.ts";
import { chungnam } from "./chungnam.ts";
import { daejeon } from "./daejeon.ts";
import { jeonbuk } from "./jeonbuk.ts";
import { jeonnam } from "./jeonnam.ts";
import { gwangju } from "./gwangju.ts";
import { gyeongbuk } from "./gyeongbuk.ts";
import { daegu } from "./daegu.ts";
import { gyeongnam } from "./gyeongnam.ts";
import { ulsan } from "./ulsan.ts";
import { busan } from "./busan.ts";
import { jeju } from "./jeju.ts";

/**
 * 전국 229개 시군구. 끝판왕.
 *
 * 지금까지 가장 긴 코스가 경기 31곳이었다. 한 시도를 다 외운 사람에게 다음에
 * 할 것이 다른 시도밖에 없었고, 열여섯 개를 다 돌아도 그 사실을 한 판으로
 * 증명할 자리가 없었다. 이 코스가 그 자리다.
 *
 * ── 순서 ─────────────────────────────────────────────────────
 * 새로 짜지 않고 **이미 있는 열여섯 경로를 잇는다.** 각 코스는 인접한 지역을
 * 따라 손으로 짠 길이고, 그 길들을 전국 17 시도 코스가 쓰는 순서(서울에서
 * 제주까지, 대체로 북에서 남으로)대로 이으면 전국을 한 바퀴 도는 경로가 된다.
 * 228곳을 처음부터 다시 이으면 그 열여섯 번의 판단을 버리는 셈이다.
 *
 * 세종은 여기에만 있다. 시도이면서 그 아래 시군이 없어 시군구 코스가 따로
 * 없는데, 빼 놓으면 **지도 한복판에 구멍이 남는다.** 대전과 전북 사이, 전국
 * 17 시도가 세종을 두는 바로 그 자리에 넣는다.
 *
 * ── 이름이 겹치는 곳 ──────────────────────────────────────────
 * 광역시 자치구 때문에 같은 이름이 스물아홉 곳 있다(`중구` 여섯, `동구` 여섯,
 * `서구` 다섯, `북구`·`남구` 넷씩, `강서구` 둘, `고성군` 둘).
 *
 * 지도가 어디인지 보여 주므로 플레이에는 지장이 없지만, 그 스물아홉 곳은
 * 사실상 공짜 문제다 — 광역시 자치구가 뜨면 위치를 몰라도 중구·동구·서구
 * 중 하나다. 대신 `고성군`(강원·경남)만은 진짜로 헷갈리는 짝이다.
 *
 * ── 기록 ─────────────────────────────────────────────────────
 * 이 코스의 지역은 전부 다른 코스에도 있다(`overlapping`). 그래서 정복도에서
 * 두 번 세지 않고, 오답은 지역이 원래 속한 시도 코스의 노트로 나눠 담는다.
 * `lib/score/notebooks.ts` 참조.
 */
export const nationwide: Course = {
  id: "nationwide",
  name: "전국 229 시군구",
  group: "nationwide",
  placeUnit: "시군구",
  /*
   * v1은 228곳이었다. 세종을 넣으면서 총 타수가 달라졌으므로 옛 기록과 같은
   * 순위표에 섞을 수 없다(data/types.ts의 판번호 규칙).
   */
  version: 2,
  description: "서울에서 제주까지, 대한민국 시군구 전부",
  // 접두사가 없으면 시군구 원본 전체가 들어온다.
  geo: { file: "municipalities", simplifyPercent: 20 },
  overlapping: true,
  regions: [
    ...seoul.regions,
    ...incheon.regions,
    ...gyeonggi.regions,
    ...gangwon.regions,
    ...chungbuk.regions,
    ...chungnam.regions,
    ...daejeon.regions,
    /*
     * 세종. 시군 코스가 없어 어느 코스에도 안 들어 있던 곳이라 여기서만 만난다.
     * 오답도 갈 곳이 없어 이 코스 노트에 남는다(lib/score/notebooks.ts의 기본값).
     */
    place("36110", "세종", "시", ["세종특별자치시"]),
    ...jeonbuk.regions,
    ...jeonnam.regions,
    ...gwangju.regions,
    ...gyeongbuk.regions,
    ...daegu.regions,
    ...gyeongnam.regions,
    ...ulsan.regions,
    ...busan.regions,
    ...jeju.regions,
  ],
};

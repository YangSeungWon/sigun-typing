import type { Course } from "../types.ts";
import { chungbuk } from "./chungbuk.ts";
import { chungnam } from "./chungnam.ts";
import { gyeongbuk } from "./gyeongbuk.ts";
import { gyeongnam } from "./gyeongnam.ts";
import { jeju } from "./jeju.ts";
import { jeonbuk } from "./jeonbuk.ts";
import { jeonnam } from "./jeonnam.ts";
import { busan } from "./busan.ts";
import { daegu } from "./daegu.ts";
import { daejeon } from "./daejeon.ts";
import { gwangju } from "./gwangju.ts";
import { incheon } from "./incheon.ts";
import { ulsan } from "./ulsan.ts";
import { gangwon } from "./gangwon.ts";
import { gyeonggi } from "./gyeonggi.ts";
import { seoul } from "./seoul.ts";
import { jongno } from "./jongno.ts";
import { sidoCourse } from "./sido.ts";
import { nationwide } from "./nationwide.ts";

/*
 * 읍면동 코스 251개. 자동 생성이라 시도별로 한 파일에 담긴다
 * (`npm run build:dong`). 종로구만 손으로 쓴 것이 따로 있다.
 */
import { dong_busan } from "./dong-busan.ts";
import { dong_chungbuk } from "./dong-chungbuk.ts";
import { dong_chungnam } from "./dong-chungnam.ts";
import { dong_daegu } from "./dong-daegu.ts";
import { dong_daejeon } from "./dong-daejeon.ts";
import { dong_gangwon } from "./dong-gangwon.ts";
import { dong_gwangju } from "./dong-gwangju.ts";
import { dong_gyeongbuk } from "./dong-gyeongbuk.ts";
import { dong_gyeonggi } from "./dong-gyeonggi.ts";
import { dong_gyeongnam } from "./dong-gyeongnam.ts";
import { dong_incheon } from "./dong-incheon.ts";
import { dong_jeju } from "./dong-jeju.ts";
import { dong_jeonbuk } from "./dong-jeonbuk.ts";
import { dong_jeonnam } from "./dong-jeonnam.ts";
import { dong_sejong } from "./dong-sejong.ts";
import { dong_seoul } from "./dong-seoul.ts";
import { dong_ulsan } from "./dong-ulsan.ts";

export const COURSES: Course[] = [
  sidoCourse,
  nationwide,
  seoul,
  incheon,
  gyeonggi,
  gangwon,
  daejeon,
  gwangju,
  daegu,
  ulsan,
  busan,
  chungbuk,
  chungnam,
  jeonbuk,
  jeonnam,
  gyeongbuk,
  gyeongnam,
  jeju,
  jongno,
  ...dong_busan,
  ...dong_chungbuk,
  ...dong_chungnam,
  ...dong_daegu,
  ...dong_daejeon,
  ...dong_gangwon,
  ...dong_gwangju,
  ...dong_gyeongbuk,
  ...dong_gyeonggi,
  ...dong_gyeongnam,
  ...dong_incheon,
  ...dong_jeju,
  ...dong_jeonbuk,
  ...dong_jeonnam,
  ...dong_sejong,
  ...dong_seoul,
  ...dong_ulsan,
];

export function getCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

export {
  busan,
  nationwide,
  chungbuk,
  chungnam,
  daegu,
  daejeon,
  gangwon,
  gwangju,
  gyeonggi,
  gyeongbuk,
  gyeongnam,
  incheon,
  jeju,
  jeonbuk,
  jeonnam,
  jongno,
  seoul,
  sidoCourse,
  ulsan,
};

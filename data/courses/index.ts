import type { Course } from "../types";
import { chungbuk } from "./chungbuk";
import { chungnam } from "./chungnam";
import { gyeongbuk } from "./gyeongbuk";
import { gyeongnam } from "./gyeongnam";
import { jeju } from "./jeju";
import { jeonbuk } from "./jeonbuk";
import { jeonnam } from "./jeonnam";
import { busan } from "./busan";
import { daegu } from "./daegu";
import { daejeon } from "./daejeon";
import { gwangju } from "./gwangju";
import { incheon } from "./incheon";
import { ulsan } from "./ulsan";
import { gangwon } from "./gangwon";
import { gyeonggi } from "./gyeonggi";
import { seoul } from "./seoul";
import { sidoCourse } from "./sido";

export const COURSES: Course[] = [
  sidoCourse,
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
];

export function getCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

export {
  busan,
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
  seoul,
  sidoCourse,
  ulsan,
};

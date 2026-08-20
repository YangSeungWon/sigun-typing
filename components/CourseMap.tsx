"use client";

import type { CourseGeo } from "@/data/geo/types";
import { useMastery } from "@/lib/useMastery";
import { RegionMap } from "./RegionMap";

/**
 * 코스 지도에 내가 아는 곳을 칠한다.
 *
 * 이 색은 원래 첫 화면의 미니게임 지도에 있었다. 첫 화면이 코스 목록이
 * 되면서 그 지도가 사라졌는데, 색까지 함께 버릴 이유는 없었다 — 오히려
 * 여기가 제자리다. 첫 화면에서 "당신이 아는 곳"은 지도를 고르러 온 사람에게
 * 끼어드는 말이지만, **경기도 코스를 들여다보는 사람에게 경기도에서 어디를
 * 아는지는 지금 필요한 정보**다.
 *
 * 해 본 적이 없으면 아무 색도 없다. 첫 방문자의 지도는 회색이어야 한다.
 */
export function CourseMap({ geo, courseId }: { geo: CourseGeo; courseId: string }) {
  const { known, confusing } = useMastery(courseId, geo);

  return (
    <RegionMap
      geo={geo}
      passedCodes={known}
      missedCodes={confusing}
      variant="route"
      /*
       * 여기서는 짚어 보면 이름이 뜬다. 고르는 화면이므로 답을 가릴 이유가
       * 없고, "이 모양이 어디지"를 손으로 확인하는 것이 이 게임이 가르치려는
       * 것과 같은 방향이다.
       */
      explore
      className="h-64 w-auto max-w-full sm:h-80"
    />
  );
}

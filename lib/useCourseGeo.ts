"use client";

import { useEffect, useState } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { loadCourseGeo } from "./geo";

/**
 * 코스 지도를 브라우저에서 불러온다.
 *
 * 놀 코스를 서버가 미리 알 수 없는 화면(멀티 방)에서만 쓴다. 싱글은 주소에
 * 코스가 들어 있으므로 서버에서 읽어 넘기는 편이 낫다 — 첫 화면에 지도가
 * 이미 있어야 한다.
 *
 * 그래서 대기실에서 방의 코스가 정해지는 즉시 부른다. 출발 신호를 받고
 * 부르면 첫 문제에서만 지도가 비고, 회상 게임에서 그건 문제가 안 보이는 것과
 * 같다.
 */
export function useCourseGeo(courseId: string | undefined): CourseGeo | null {
  const [geo, setGeo] = useState<CourseGeo | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let alive = true;
    void loadCourseGeo(courseId).then((loaded) => {
      if (alive) setGeo(loaded);
    });
    return () => {
      alive = false;
    };
  }, [courseId]);

  return geo;
}

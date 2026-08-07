import type { CourseGeo } from "@/data/geo/types";

/**
 * 코스별 지도 데이터를 서버에서 읽어 온다. 동적 import라 실제로 노는 코스의
 * 지도만 번들에 들어간다.
 *
 * 코스를 추가하면 여기에도 한 줄이 필요하다. 빠뜨리면 지도 없이 조용히 돌아가
 * 알아채기 어려우므로, data/geo/geo.test.ts가 코스 목록과 대조해 잡아 준다.
 */
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  sido: () => import("@/data/geo/sido.json"),
  seoul: () => import("@/data/geo/seoul.json"),
  gyeonggi: () => import("@/data/geo/gyeonggi.json"),
  gangwon: () => import("@/data/geo/gangwon.json"),
  incheon: () => import("@/data/geo/incheon.json"),
  daejeon: () => import("@/data/geo/daejeon.json"),
  gwangju: () => import("@/data/geo/gwangju.json"),
  daegu: () => import("@/data/geo/daegu.json"),
  ulsan: () => import("@/data/geo/ulsan.json"),
  busan: () => import("@/data/geo/busan.json"),
  chungbuk: () => import("@/data/geo/chungbuk.json"),
  chungnam: () => import("@/data/geo/chungnam.json"),
  jeonbuk: () => import("@/data/geo/jeonbuk.json"),
  jeonnam: () => import("@/data/geo/jeonnam.json"),
  gyeongbuk: () => import("@/data/geo/gyeongbuk.json"),
  gyeongnam: () => import("@/data/geo/gyeongnam.json"),
  jeju: () => import("@/data/geo/jeju.json"),
};

export function hasCourseGeo(courseId: string): boolean {
  return courseId in LOADERS;
}

export async function loadCourseGeo(courseId: string): Promise<CourseGeo | null> {
  const load = LOADERS[courseId];
  if (!load) return null;
  return (await load()).default as CourseGeo;
}

import type { CourseGrid } from "./grid";
import GRIDS from "@/data/emoji-grid.json";

/**
 * 코스별 격자 자리표를 읽는다. **서버에서만 부른다.**
 *
 * 파일 하나에 270개 코스가 들어 있어 70KB가 넘는다. 클라이언트에서 부르면
 * 그게 통째로 판 화면 번들에 실린다 — 정작 필요한 것은 지금 코스 하나뿐이고,
 * 그마저도 판이 끝나고 공유를 누른 사람에게만 쓸모가 있다.
 *
 * 그래서 서버 컴포넌트가 여기서 한 코스를 꺼내 Game에 넘긴다. 정적 생성이라
 * 빌드 때 값이 박히고, 브라우저로 가는 것은 그 코스의 격자뿐이다.
 */
export function loadCourseGrid(courseId: string): CourseGrid | null {
  return (GRIDS as Record<string, CourseGrid>)[courseId] ?? null;
}

/**
 * 브라우저에서 읽는다. **대결에서만 쓴다.**
 *
 * 대기실에서 코스가 정해지므로 서버가 미리 꺼내 줄 수 없다. 동적 import라
 * 이 70KB는 판이 끝나고 결과가 뜨는 순간에야 내려온다 — 달리는 동안의 무게는
 * 그대로다. 코스 하나만 받아 오게 쪼갤 수도 있지만, 그러려면 파일 270개나
 * 라우트 하나가 더 생긴다. 한 번 받고 마는 값에 그만한 값은 없다.
 */
export async function fetchCourseGrid(courseId: string): Promise<CourseGrid | null> {
  const loaded = await import("@/data/emoji-grid.json");
  return (loaded.default as Record<string, CourseGrid>)[courseId] ?? null;
}

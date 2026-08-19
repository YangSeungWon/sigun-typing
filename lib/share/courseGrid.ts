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

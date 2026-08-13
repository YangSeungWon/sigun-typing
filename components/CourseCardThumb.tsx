"use client";

import { CourseThumb } from "@/components/CourseThumb";
import { loadPersonalBest } from "@/lib/score/personalBest";
import { useIsHydrated } from "@/lib/useIsHydrated";

/**
 * 목록의 실루엣. 다 돈 코스는 초록으로 칠한다.
 *
 * 글자로 `완주`라고 적는 것만으로는 목록을 훑을 때 보이지 않는다 — 열일곱 장을
 * 스크롤하는 눈에 걸리는 것은 색이지 단어가 아니다. 초록이 지나온 땅이라는
 * 것은 플레이 지도와 코스 지도에서 이미 쓰는 말이라 따로 배울 것도 없다.
 *
 * 기록은 이 브라우저에만 있으므로 하이드레이션 뒤에 색이 붙는다.
 */
export function CourseCardThumb({
  courseId,
  courseVersion,
  total,
  className,
}: {
  courseId: string;
  courseVersion: number;
  total: number;
  className?: string;
}) {
  const hydrated = useIsHydrated();
  const best = hydrated ? loadPersonalBest(courseId, "map", courseVersion) : null;

  return (
    <CourseThumb
      courseId={courseId}
      done={best?.completed === total}
      className={className}
    />
  );
}

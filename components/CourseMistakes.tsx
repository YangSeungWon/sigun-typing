"use client";

import Link from "next/link";
import { useMemo } from "react";
import { loadMistakes } from "@/lib/score/mistakes";
import { useIsHydrated } from "@/lib/useIsHydrated";

/**
 * 이 코스에서 헷갈린 곳으로 가는 길.
 *
 * 한때 첫 화면에 `헷갈리는 지역 3곳` 카드가 있었다. 기능은 쓸모 있지만 그
 * 자리가 틀렸다 — 지도를 고르러 온 사람에게 개인 대시보드가 먼저 나오면
 * 이 서비스가 무엇인지가 흐려진다.
 *
 * 여기서는 다르다. 이미 그 코스를 보고 있는 사람에게 "이 코스에서 세 곳을
 * 헷갈렸다"는 추천이 아니라 맥락이다. 헷갈린 적이 없으면 아무것도 그리지
 * 않는다 — 첫 방문자에게 빈 상자를 줄 이유가 없다.
 */
export function CourseMistakes({ courseId }: { courseId: string }) {
  const hydrated = useIsHydrated();
  const count = useMemo(
    () => (hydrated ? loadMistakes(courseId).length : 0),
    [hydrated, courseId],
  );

  if (count === 0) return null;

  return (
    <Link
      href={`/review/${courseId}`}
      className="text-center font-mono text-sm text-dim transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      이 코스에서 헷갈린 곳 {count}곳 →
    </Link>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CourseGeo } from "@/data/geo/types";
import type { Course } from "@/data/types";
import { loadMistakes } from "@/lib/score/mistakes";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { Game } from "./Game";

interface ReviewGameProps {
  course: Course;
  geo?: CourseGeo | null;
}

/**
 * 오답만 골라 푸는 판.
 *
 * 오답 목록은 기기에만 있으므로 코스를 서버에서 만들 수 없다. 서버는 코스 전체와
 * 지도를 내려 주고, 여기서 걸러 낸다. 코스 id는 그대로 두어야 이 판의 결과도
 * 같은 오답노트에 반영된다.
 */
export function ReviewGame({ course, geo }: ReviewGameProps) {
  // 서버에는 오답 목록이 없다. 하이드레이션 전에 읽으면 화면이 어긋난다.
  const hydrated = useIsHydrated();

  // hydrated는 한 번만 바뀌므로 목록도 판이 도는 동안 그대로다.
  const reviewCourse = useMemo<Course | null>(() => {
    if (!hydrated) return null;
    const codes = new Set(loadMistakes(course.id).map((m) => m.code));
    const regions = course.regions.filter((r) => codes.has(r.code));
    if (regions.length === 0) return null;
    return {
      ...course,
      name: `${course.name} · 오답 ${regions.length}곳`,
      description: "자주 틀린 곳만 모았습니다",
      regions,
    };
  }, [hydrated, course]);

  if (!hydrated) {
    return <main className="flex flex-1" aria-hidden="true" />;
  }

  if (!reviewCourse) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">복습할 오답이 없습니다</h1>
        <p className="text-dim">
          {course.name}에서 틀린 곳이 아직 없거나, 이미 다 외우셨습니다.
        </p>
        <div className="flex gap-3">
          <Link
            href={`/play/map/${course.id}`}
            className="rounded-lg bg-sign px-5 py-3 font-medium text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            코스 전체 풀기
          </Link>
          <Link
            href="/notes"
            className="rounded-lg border border-concrete-deep px-5 py-3 font-medium transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            오답노트
          </Link>
        </div>
      </main>
    );
  }

  return <Game course={reviewCourse} mode="map" geo={geo} practice />;
}

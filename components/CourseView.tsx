"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/track";
import type { ModeId } from "@/lib/game/types";

/** 코스를 열었다는 사실만 남긴다. 퍼널의 첫 칸이다. */
export function CourseView({ courseId, mode }: { courseId: string; mode: ModeId }) {
  useEffect(() => {
    track({ name: "course_view", courseId, mode });
  }, [courseId, mode]);

  return null;
}

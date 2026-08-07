"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/track";

/** 홈에 도달했다는 사실. 퍼널의 맨 앞 칸이다. */
export function HomeView() {
  useEffect(() => {
    track({ name: "home_view" });
  }, []);

  return null;
}

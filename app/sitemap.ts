import type { MetadataRoute } from "next";
import { COURSES } from "@/data/courses";
import { MODE_LADDER } from "@/lib/game/modes";
import { siteUrl } from "@/lib/site";

/**
 * 색인에 넣을 주소.
 *
 * 개인 화면(오답노트·오답 연습)은 넣지 않는다. 기기마다 내용이 다르고
 * 남에게는 빈 화면이라 색인할 값이 없다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const at = (path: string) => `${siteUrl()}${path}`;

  const modes = MODE_LADDER.map((mode) => ({
    url: at(`/play/${mode}`),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const games = MODE_LADDER.flatMap((mode) =>
    COURSES.map((course) => ({
      url: at(`/play/${mode}/${course.id}`),
      changeFrequency: "monthly" as const,
      // 본편인 지도 타이핑을 조금 더 높게 둔다.
      priority: mode === "map" ? 0.7 : 0.6,
    })),
  );

  // 코스 소개는 검색 유입의 착지점이다. 게임 화면보다 우선순위를 높게 둔다.
  const courses = COURSES.map((course) => ({
    url: at(`/courses/${course.id}`),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    { url: at("/"), changeFrequency: "weekly", priority: 1 },
    ...courses,
    ...modes,
    ...games,
    { url: at("/guide"), changeFrequency: "monthly", priority: 0.6 },
    { url: at("/ranking"), changeFrequency: "daily", priority: 0.5 },
    { url: at("/rooms"), changeFrequency: "monthly", priority: 0.4 },
    { url: at("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: at("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
}

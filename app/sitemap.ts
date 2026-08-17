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
    // 코스 목록. 첫 화면이 상태판이 된 뒤로 코스로 들어가는 문은 여기다.
    { url: at("/courses"), changeFrequency: "weekly", priority: 0.9 },
    ...courses,
    ...games,
    { url: at("/guide"), changeFrequency: "monthly", priority: 0.6 },
    /*
     * 변천사는 게임이 아니라 읽을거리다. 검색으로 들어오는 길이 게임 화면과
     * 다르고("행정구역 변천", "직할시 광역시 차이"), 잘 안 바뀐다.
     */
    { url: at("/history"), changeFrequency: "yearly", priority: 0.7 },
    { url: at("/ranking"), changeFrequency: "daily", priority: 0.5 },
    { url: at("/rooms"), changeFrequency: "monthly", priority: 0.4 },
    { url: at("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: at("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
}

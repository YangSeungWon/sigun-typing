import type { MetadataRoute } from "next";
import { COURSES } from "@/data/courses";
import eventYears from "@/data/timelapse/event-years.json";
import dongHistoryIds from "@/data/timelapse/dong-history-ids.json";
import { siteUrl } from "@/lib/site";

/**
 * 색인에 넣을 주소.
 *
 * 개인 화면(오답노트·오답 연습)은 넣지 않는다. 기기마다 내용이 다르고
 * 남에게는 빈 화면이라 색인할 값이 없다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const at = (path: string) => `${siteUrl()}${path}`;

  /*
   * **`learn`은 안 싣는다.**
   *
   * 같은 270곳을 세는 주소가 셋이었다 — `/courses/<코스>`, `/play/map`,
   * `/play/learn`. 872개 중 810개가 그 셋이다. 구글은 그중 190개를 가져간
   * 뒤로 사실상 멈췄고, 남은 682개는 "알긴 아는데 안 가져간" 상태로 서 있다.
   * 막힌 곳이 색인이 아니라 **크롤**이라는 뜻이다(크롤한 것은 100% 색인된다).
   *
   * 셋 중 무엇을 뺄지는 세어 보면 나온다.
   *
   *   /courses/<코스>   색인 113   노출 있음, 클릭도 있음
   *   /play/map         색인  38   노출 4 · 클릭 2
   *   /play/learn       색인  26   노출 0 · 클릭 0
   *
   * `learn`은 답이 화면에 적혀 있는 모드라 검색으로 들어올 말도 따로 없다.
   * 270개를 덜어 낸 예산이 코스 소개와 아직 한 번도 안 가져간 동네별 변천으로
   * 간다. 화면에서 사라지는 것은 아니다 — 목록과 코스 소개에서 그대로 간다.
   */
  const games = COURSES.map((course) => ({
    url: at(`/play/map/${course.id}`),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  /*
   * 코스 소개는 검색 유입의 착지점이다. 게임 화면보다 우선순위를 높게 둔다.
   *
   * 읍면동도 넣는다. 목록 화면에는 안 보이지만 검색에서는 이쪽이 오히려
   * 경쟁이 약하다 — `강남구 동 이름`을 찾는 사람에게 보일 곳이 여기뿐이다.
   * 다만 시군구보다는 낮게 둔다. 아는 사람만 찾는 페이지다.
   */
  const courses = COURSES.map((course) => ({
    url: at(`/courses/${course.id}`),
    changeFrequency: "monthly" as const,
    priority: course.level === "dong" ? 0.6 : 0.8,
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
    /*
     * 개편 한 건씩. `창원 통합`, `군위군 대구 편입`처럼 실제로 찾는 말이라
     * 변천사 첫 화면보다 오히려 구체적인 유입이 걸린다.
     */
    ...eventYears.map((year) => ({
      url: at(`/history/${year}`),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    /*
     * 동네별 변천. 목록에는 안 세우지만 검색으로는 닿아야 한다 —
     * `성북구 동 통폐합`을 찾는 사람에게 보일 곳이 여기뿐이다.
     */
    ...(dongHistoryIds as string[]).map((id) => ({
      url: at(`/history/dong/${id}`),
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
    { url: at("/ranking"), changeFrequency: "daily", priority: 0.5 },
    { url: at("/rooms"), changeFrequency: "monthly", priority: 0.4 },
    { url: at("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: at("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
}

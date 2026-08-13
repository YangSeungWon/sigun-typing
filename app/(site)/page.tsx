import { HomeView } from "@/components/HomeView";
import { Home } from "@/components/home/Home";
import { buildHomeSeed } from "@/lib/home/summary";
import { loadCourseGeo } from "@/lib/geo";

/**
 * 첫 화면 = 지금 한 판 시작시키는 화면.
 *
 * 오래 코스 목록이었다. 그 자리에 둔 근거는 분명했고 지금도 절반은 맞다 —
 * 이 서비스는 오늘 뭘 할지 추천해 주는 곳이 아니라 지도를 고르고 노는 곳이고,
 * 권역으로 묶인 목록 자체가 서비스가 무엇인지 설명한다.
 *
 * 다만 그 설명이 필요한 사람은 **처음 온 사람뿐**이라는 것이 드러났다. 두 번째
 * 방문부터 묻는 것은 "어떤 지도가 있나"가 아니라 "어디까지 했더라"다. 목록을
 * 없앤 것이 아니라 늘 첫 장이던 것을 필요할 때 펴는 자리(`/courses`)로 옮겼고,
 * 그 자리는 아래 탭에 `도전`으로 늘 열려 있다.
 *
 * 한때 `오늘의 도전`과 `대한민국 정복도` 카드가 함께 있었다. 지도 옆에 시도
 * 목록을 붙이면서 정복도 카드는 그 목록의 열등한 사본이 됐고(같은 숫자를
 * 열여섯 개 대신 다섯 개만), 오늘의 도전은 히어로·지도·목록에 이어 네 번째로
 * 코스를 고르는 자리였다. 남은 것은 여기 아니면 볼 수 없는 것들뿐이다.
 */
export const metadata = {
  alternates: { canonical: "/" },
};

/*
 * 이 화면에는 서버가 정하는 값이 남아 있지 않다 — 숫자도 진행도도 전부 이
 * 기기의 기록이고, 코스 목록은 빌드 시점에 고정된다. 그래도 완전 정적으로
 * 두지 않는 이유는 코스가 늘거나 이름이 바뀔 때 다시 그려질 여지를 남기려는
 * 것뿐이라, 자주 볼 이유가 없어 넉넉하게 잡는다.
 */
export const revalidate = 3600;

export default async function HomePage() {
  /*
   * 지도는 서버에서 읽어 내려보낸다. RSC 페이로드에 데이터로 실릴 뿐 JS 번들에
   * 들어가지 않고, 무엇보다 첫 HTML에 이미 지도가 있다 — 첫 화면의 절반이
   * 그림인데 그것이 나중에 튀어나오면 화면이 한 번 무너졌다 세워진다.
   */
  const geo = await loadCourseGeo("sido");

  /*
   * 코스 요약을 얇게 깎아 넘긴다. 브라우저가 이 기기의 기록을 세려면 코스마다
   * 이름·판번호·개수를 알아야 하는데, 그것을 알자고 COURSES를 클라이언트로
   * 끌고 가면 245개 지역 객체가 통째로 따라온다.
   */
  const seed = buildHomeSeed();

  return (
    <>
      <HomeView />
      <Home seed={seed} geo={geo} />
    </>
  );
}

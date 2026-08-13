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
 * 한때 여기 있다가 빠졌던 것들(오늘의 도전·헷갈리는 지역)이 돌아왔다. 그때
 * 뺀 이유는 셋이 서로 다른 제품처럼 경쟁하면서 정작 알맹이인 코스를 한 단계
 * 아래로 밀어냈기 때문인데, 코스가 자기 탭을 가진 지금은 그 경쟁이 없다.
 */
export const metadata = {
  alternates: { canonical: "/" },
};

/*
 * 하루가 바뀌면 오늘의 도전도 바뀐다. 60초마다 다시 만든다 — KST 자정 직후
 * 최대 1분간 어제 코스가 남을 수 있는데, 데일리에서 그 정도는 값이 아니다.
 *
 * 순위표는 더 이상 여기서 읽지 않는다. 코스별 1위는 목록과 함께 /courses로 갔다.
 */
export const revalidate = 60;

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
  // 서버 컴포넌트라 60초에 한 번 평가된다. 이 규칙이 막으려는 것은 클라이언트
  // 재렌더마다 값이 흔들리는 경우이고, 여기서는 그날의 코스를 정하려고 날짜를
  // 읽는 것이 의도한 동작이다(ranking/page.tsx도 같은 이유로 열어 두었다).
  // eslint-disable-next-line react-hooks/purity
  const seed = buildHomeSeed(Date.now());

  return (
    <>
      <HomeView />
      <Home seed={seed} geo={geo} />
    </>
  );
}

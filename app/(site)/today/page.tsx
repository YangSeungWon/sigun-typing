import { getCourse } from "@/data/courses";
import { loadCourseGeo } from "@/lib/geo";
import { pickForDay, quizDate } from "@/lib/daily/pick";
import { DailyQuiz, type QuizRegion } from "@/components/daily/DailyQuiz";

/**
 * 오늘의 퀴즈.
 *
 * 하루가 KST 자정에 넘어가므로 미리 만들어 둘 수 없다. 요청마다 그린다 —
 * 정적으로 구우면 자정을 넘겨도 어제 문제가 남는다.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "오늘의 퀴즈",
  description: "하루에 한 곳. 지도를 보고 어느 시군구인지 맞힙니다.",
};

export default async function TodayPage() {
  const course = getCourse("nationwide")!;
  const sidoCourse = getCourse("sido")!;
  const geo = await loadCourseGeo(course.id);

  /*
   * 위치는 지도 파일에 있고(cx·cy) 이름과 별칭은 코스 데이터에 있다. 둘을 코드로
   * 맞춰 한 벌로 만든다 — 화면이 두 곳을 따로 뒤지게 두면 어긋날 자리가 생긴다.
   */
  const at = new Map(geo!.regions.map((r) => [r.code, r]));
  const regions: QuizRegion[] = course.regions.flatMap((r) => {
    const spot = at.get(r.code);
    return spot ? [{ code: r.code, name: r.name, aliases: r.aliases, cx: spot.cx, cy: spot.cy }] : [];
  });

  // force-dynamic 서버 컴포넌트라 요청마다 한 번 평가된다. 이 규칙이 막으려는
  // 것은 클라이언트 재렌더 때마다 값이 흔들리는 경우이고, 여기서는 요청 시각을
  // 읽는 것이 의도한 동작이다(랭킹 화면과 같다).
  // eslint-disable-next-line react-hooks/purity
  const today = pickForDay(regions, Date.now());
  if (!today || !geo) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl font-bold tracking-tight">오늘의 퀴즈</h1>
        <p className="font-mono text-sm text-dim">{quizDate(today.day)}</p>
      </header>

      <DailyQuiz
        day={today.day}
        geo={geo}
        regions={regions}
        sidos={sidoCourse.regions.map((r) => ({ code: r.code, name: r.name }))}
        answerCode={today.item.code}
        sidoName={
          sidoCourse.regions.find((r) => r.code === today.item.code.slice(0, 2))?.name ??
          null
        }
      />
    </main>
  );
}

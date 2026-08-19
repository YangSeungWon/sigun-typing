import { permanentRedirect } from "next/navigation";
import { notFound } from "next/navigation";
import { CourseView } from "@/components/CourseView";
import { Game } from "@/components/Game";
import { COURSES, getCourse } from "@/data/courses";
import { loadCourseGeo } from "@/lib/geo";
import { loadCourseGrid } from "@/lib/share/courseGrid";
import { isModeId, MODES, MODE_LABELS } from "@/lib/game/modes";

export function generateStaticParams() {
  return Object.keys(MODES).flatMap((mode) =>
    COURSES.map((course) => ({ mode, course: course.id })),
  );
}

/**
 * 없어진 판으로 온 사람.
 *
 * 타임어택(60초)과 실력 테스트를 본편에 합쳤다. 그 주소로 공유된 링크가
 * 남아 있을 수 있으므로 404로 돌려보내지 않고 본편으로 넘긴다 — 어차피 같은
 * 게임이고, 그 사람이 하려던 것도 이 코스를 푸는 것이다.
 */
const RETIRED: Record<string, string> = { timeattack: "map", test: "map" };

export default async function PlayPage({ params }: PageProps<"/play/[mode]/[course]">) {
  const { mode, course: courseId } = await params;
  const course = getCourse(courseId);
  if (course && RETIRED[mode]) permanentRedirect(`/play/${RETIRED[mode]}/${course.id}`);
  if (!course || !isModeId(mode)) notFound();

  const geo = await loadCourseGeo(course.id);
  /*
   * 자랑용 격자는 여기서 꺼낸다. 자리표 전체는 70KB가 넘어 브라우저로 보낼
   * 물건이 아니고, 필요한 것은 이 코스 한 줄이다(lib/share/courseGrid.ts).
   */
  const grid = loadCourseGrid(course.id);
  return (
    <>
      <CourseView courseId={course.id} mode={mode} />
      <Game course={course} mode={mode} geo={geo} grid={grid} />
    </>
  );
}

export async function generateMetadata({ params }: PageProps<"/play/[mode]/[course]">) {
  const { mode, course: courseId } = await params;
  const course = getCourse(courseId);
  if (!course || !isModeId(mode)) return {};
  // 뒤의 "— 시군 타이핑"은 루트 layout의 template이 붙인다.
  const title = `${course.name} · ${MODE_LABELS[mode]}`;
  /*
   * 공유 카드의 제목도 함께 바꾼다. openGraph를 아예 안 적으면 루트의 것을
   * 그대로 물려받아, 어떤 코스를 공유하든 카드에는 "시군 타이핑"만 뜬다.
   * template은 공유 카드까지 닿지 않으므로 여기서는 이름을 직접 붙인다.
   * 이미지는 루트와 같은 한 장을 쓴다 — 코스마다 뜨는 건 그만한 값이 없다.
   */
  return {
    title,
    description: course.description,
    openGraph: {
      title: `${title} — 시군 타이핑`,
      description: course.description,
      url: `/play/${mode}/${course.id}`,
      images: ["/og.png"],
    },
  };
}

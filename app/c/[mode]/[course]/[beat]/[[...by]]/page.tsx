import { notFound } from "next/navigation";
import { CourseView } from "@/components/CourseView";
import { Game } from "@/components/Game";
import { getCourse } from "@/data/courses";
import { loadCourseGeo } from "@/lib/geo";
import { loadCourseGrid } from "@/lib/share/courseGrid";
import { isModeId, MODE_LABELS } from "@/lib/game/modes";
import { toChallenge } from "@/lib/game/challenge";

/**
 * 도전장 주소.
 *
 * `/c/map/seoul/41080/승원`
 *
 * ── 왜 쿼리가 아니라 경로인가 ────────────────────────────────
 * 도전장은 여태 `/play/map/seoul?beat=41080&by=승원`이었다. 게임은 잘 돌았지만
 * **미리보기 카드가 아무 말도 하지 않았다.** 카톡·디스코드·트위터가 링크를
 * 펼칠 때 읽는 것은 OG 태그이고, 그것을 기록에 맞춰 바꾸려면
 * `generateMetadata`가 쿼리를 읽어야 한다. 그 순간 `/play/[mode]/[course]`
 * 807개가 통째로 정적 생성에서 빠져 요청마다 서버 렌더가 된다. 게임 첫 화면이
 * 느려지는 값으로는 너무 비싸다.
 *
 * 그래서 도전장에 자기 주소를 준다. 여기만 동적이고 `/play/...`는 정적인 채로
 * 남는다. 이 경로로 오는 사람은 링크를 받은 사람뿐이다.
 *
 * 옛 주소도 그대로 둔다. 이미 카톡방에 나가 있는 링크가 죽으면 안 되고,
 * `readChallenge()`가 여전히 쿼리를 읽는다.
 *
 * ── 이름은 경로 끝에 ─────────────────────────────────────────
 * 선택 항목이라 catch-all로 받는다. 이름에 `/`가 들어가면 조각이 여럿이 되므로
 * 다시 잇는다. 어차피 값을 믿지 않는다 — 화면에 띄우는 목표 문구일 뿐
 * 순위에는 아무 영향도 주지 않으므로, 고쳐 봐야 자기 화면의 시간만 바뀐다.
 */

/** 사람이 읽는 기록. 공유 메시지와 같은 말투여야 한다. */
function spoken(ms: number): string {
  const total = ms / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = (total % 60).toFixed(2);
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

type Params = PageProps<"/c/[mode]/[course]/[beat]/[[...by]]">;

async function read(params: Params["params"]) {
  const { mode, course: courseId, beat, by } = await params;
  const course = getCourse(courseId);
  if (!course || !isModeId(mode)) return null;
  const challenge = toChallenge(
    beat,
    by?.map((part) => decodeURIComponent(part)).join("/") ?? null,
  );
  if (!challenge) return null;
  return { course, mode, challenge };
}

export default async function ChallengePage({ params }: Params) {
  const found = await read(params);
  if (!found) notFound();
  const { course, mode, challenge } = found;

  const [geo, grid] = [await loadCourseGeo(course.id), loadCourseGrid(course.id)];
  return (
    <>
      <CourseView courseId={course.id} mode={mode} />
      <Game course={course} mode={mode} geo={geo} grid={grid} challenge={challenge} />
    </>
  );
}

export async function generateMetadata({ params }: Params) {
  const found = await read(params);
  if (!found) return {};
  const { course, mode, challenge } = found;

  /*
   * 카드가 하는 말이 곧 도발이다. 링크를 누르기 전에 이미 승부가 걸려 있어야
   * 하고, 그게 이런 게임이 퍼지는 방식이다. 가운데점은 쓰지 않는다.
   */
  const who = challenge.by ? `${challenge.by}님의 기록` : "받은 기록";
  const title = `${course.name} ${spoken(challenge.beatMs)}`;
  const description = `${who}입니다. ${MODE_LABELS[mode]}으로 넘어설 수 있나요?`;

  return {
    title,
    description,
    // 도전장은 검색에 오를 물건이 아니다. 링크를 받은 사람만 오는 자리다.
    robots: { index: false, follow: true },
    openGraph: {
      title: `${title} — 시군 타이핑`,
      description,
      images: ["/og.png"],
    },
  };
}

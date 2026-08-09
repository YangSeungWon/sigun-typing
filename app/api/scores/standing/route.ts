import { NextResponse } from "next/server";
import { getCourse } from "@/data/courses";
import { getScoreRepository } from "@/lib/db/client";
import { isModeId } from "@/lib/game/modes";
import { SCORING_VERSION } from "@/lib/score/version";

export const dynamic = "force-dynamic";

/**
 * 이 기록이 지금 어디쯤인지.
 *
 * 결과 화면에서 "왜 등록해야 하는데?"에 답하는 숫자다. 등록 버튼만 있으면
 * 그건 그냥 양식이고, 순위가 보이면 이유가 된다.
 *
 * 기준은 순위표와 같다(타수 내림차순). 여기서만 다른 기준을 쓰면 "상위 8%"를
 * 보고 등록했는데 다른 자리에 가 있게 된다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("course") ?? "";
  const mode = url.searchParams.get("mode") ?? "";
  const cpm = Number(url.searchParams.get("cpm"));

  const course = getCourse(courseId);
  if (!course || !isModeId(mode) || !Number.isFinite(cpm) || cpm < 0) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const repo = getScoreRepository();
  const [{ better, total }, around] = await Promise.all([
    repo.standing(courseId, mode, SCORING_VERSION, course.version, cpm),
    // 바로 위·아래 두 줄씩. 상위 10명보다 이쪽이 따라잡을 마음을 만든다.
    repo.neighbors(courseId, mode, SCORING_VERSION, course.version, cpm, 2),
  ]);

  // 등록하면 앉게 될 자리. 나보다 나은 기록 수 + 1이다.
  return NextResponse.json({ rank: better + 1, total, ...around });
}

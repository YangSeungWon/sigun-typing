import { NextResponse } from "next/server";
import { getCourse } from "@/data/courses";
import { isModeId } from "@/lib/game/modes";
import { issueToken } from "@/lib/score/session";

/** 토큰은 서버 시각에 묶이므로 미리 받아 둘 수 없다. */
export const dynamic = "force-dynamic";

/**
 * 게임을 시작할 때 서명된 시작 토큰을 발급한다.
 * 이 토큰의 발급 시각이 나중에 "실제로 그만큼 시간이 흘렀는가"의 기준이 된다.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const { courseId, mode, seed } = (body ?? {}) as {
    courseId?: string;
    mode?: string;
    seed?: number;
  };

  const course = courseId ? getCourse(courseId) : undefined;
  if (!course) {
    return NextResponse.json({ error: "없는 코스입니다" }, { status: 400 });
  }
  if (!mode || !isModeId(mode)) {
    return NextResponse.json({ error: "없는 모드입니다" }, { status: 400 });
  }

  const safeSeed = Number.isInteger(seed) ? (seed as number) : 1;
  const { token } = issueToken(
    { courseId: course.id, courseVersion: course.version, mode, seed: safeSeed },
    Date.now(),
  );

  return NextResponse.json({ token, seed: safeSeed });
}

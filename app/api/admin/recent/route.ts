import { NextResponse } from "next/server";
import { getScoreRepository } from "@/lib/db/client";
import { isAdmin, NOT_FOUND } from "@/lib/api/adminToken";

export const dynamic = "force-dynamic";

/** 한 번에 볼 줄 수. 이보다 많으면 훑는 것이 아니라 뒤지는 것이다. */
const MAX = 200;

/**
 * 최근 올라온 기록을 새것부터.
 *
 * 이상한 이름을 찾는 유일한 길이 랭킹 페이지를 눈으로 훑는 것이었다. 그런데
 * 랭킹은 코스마다 상위 몇 줄만 보여 주므로 **상위권에 못 든 이상한 이름은
 * 아예 안 보인다.** 순위와 상관없이 시간순으로 늘어놓는 자리가 따로 필요하다.
 *
 * 내린 것도 함께 준다. 빼면 방금 내린 줄이 사라져서 눌렸는지 알 수 없다.
 */
export async function GET(request: Request) {
  if (!isAdmin(request)) return NextResponse.json(NOT_FOUND, { status: 404 });

  const asked = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(asked) && asked > 0 ? Math.min(asked, MAX) : 100;

  const rows = await getScoreRepository().recent(limit);
  return NextResponse.json({ rows });
}

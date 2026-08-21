import { NextResponse } from "next/server";
import { getScoreRepository } from "@/lib/db/client";
import { isAdmin, NOT_FOUND } from "@/lib/api/adminToken";

export const dynamic = "force-dynamic";

/**
 * 순위표에서 기록을 내린다.
 *
 * 이름 검사를 통과한 뒤 올라온 것을 내릴 손이 없었다. 이상한 것이 보여도
 * 할 수 있는 일이 DB에 직접 `DELETE`를 치는 것뿐이었다.
 *
 * ── 화면을 만들지 않는다 ──────────────────────────────────
 * 이걸 쓸 사람은 한 명이고, 쓰는 일은 어쩌다 한 번이다. 관리 화면을 만들면
 * 그 화면이 또 지켜야 할 문이 된다 — 로그인, 권한, 세션. 토큰 한 줄과 이
 * 라우트 하나면 `curl`로 끝난다.
 *
 *     curl -X POST https://sigun-typing.ysw.kr/api/admin/hide \\
 *       -H "x-admin-token: $ADMIN_TOKEN" \\
 *       -H "content-type: application/json" \\
 *       -d '{"id":"...","reason":"욕설"}'
 *
 * 기기로도 내릴 수 있다. 한 사람이 여러 줄을 도배했을 때 한 줄씩 지우는 것은
 * 손해다.
 *
 *     -d '{"deviceId":"...","reason":"도배"}'
 *
 * ── 지우지 않는다 ────────────────────────────────────────
 * 숨김 표시만 남긴다. 지우면 왜 지웠는지가 안 남고 잘못 눌렀을 때 되돌릴 수
 * 없다. 같은 기기가 되풀이하는지도 숨긴 것이 남아 있어야 보인다.
 *
 * 훑어보는 화면은 /admin에 있다. 거기서도 이 라우트를 부른다.
 */

export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json(NOT_FOUND, { status: 404 });

  let body: { id?: unknown; deviceId?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : undefined;
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : undefined;
  if (!id && !deviceId) {
    return NextResponse.json({ error: "id 또는 deviceId가 필요합니다" }, { status: 400 });
  }

  /*
   * 사유는 반드시 받는다. 나중에 규칙으로 만들 수 있는 유일한 재료이고,
   * 적기 귀찮아서 안 적는 것을 막으려면 필수로 두는 수밖에 없다.
   */
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "reason이 필요합니다" }, { status: 400 });
  }

  const hidden = await getScoreRepository().hide(
    id ? { id } : { deviceId },
    reason.slice(0, 200),
    new Date(),
  );
  return NextResponse.json({ hidden });
}

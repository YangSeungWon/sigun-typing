import { NextResponse } from "next/server";
import { clientKey, createRateLimiter } from "@/lib/api/rateLimit";
import { getScoreRepository } from "@/lib/db/client";
import { logError, toErrorRow } from "@/lib/observability/report";

export const dynamic = "force-dynamic";

/**
 * 브라우저에서 터진 오류를 받는다.
 *
 * 서버 오류만 보면 절반만 보는 것이다. 화면이 하얗게 죽는 종류의 고장은
 * 서버 로그에 아무 흔적도 남기지 않는다.
 *
 * 인증이 없는 창구이므로 이벤트와 같은 이유로 막아 둔다. 한 사람이 오류를
 * 무한히 밀어 넣어 디스크를 채우는 것을 막는 것이지, 남용을 완전히 봉하는
 * 장치는 아니다. 정상적인 브라우저는 한 판에 한 건도 안 보낸다.
 */
const perAddress = createRateLimiter(10, 60_000);

export async function POST(request: Request) {
  if (!perAddress.take(clientKey(request), Date.now())) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      message?: unknown;
      digest?: unknown;
      stack?: unknown;
      path?: unknown;
    };

    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    const row = toErrorRow({
      source: "client",
      message: str(body.message),
      digest: str(body.digest),
      stack: str(body.stack),
      // 주소는 클라이언트가 보낸 값이라 믿을 수 없다. 경로만 남기고 자른다.
      path: str(body.path),
      kind: "browser",
    });

    logError(row);
    await getScoreRepository().recordError(row);
  } catch {
    // 오류 보고가 실패해도 사용자는 이미 오류 화면을 보고 있다. 더 할 일이 없다.
  }
  return NextResponse.json({ ok: true });
}

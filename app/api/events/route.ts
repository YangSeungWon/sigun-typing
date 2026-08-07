import { NextResponse } from "next/server";
import { getScoreRepository } from "@/lib/db/client";
import { clientKey, createRateLimiter } from "@/lib/api/rateLimit";
import { sanitizeEvent } from "@/lib/analytics/events";

export const dynamic = "force-dynamic";

/** 한 번에 받을 이벤트 수. 이보다 많으면 정상적인 사용이 아니다. */
const MAX_EVENTS = 50;

/**
 * 빈도 제한.
 *
 * 이 창구는 인증이 없다. 관측 기간의 결론이 이 테이블에서 나오는데, 막지
 * 않으면 누구나 퍼널을 원하는 모양으로 만들거나 디스크를 채울 수 있다.
 * `internal: false`도 마음대로 보낼 수 있어 QA 제외 장치까지 무력해진다.
 *
 * 한 판은 이벤트 열 몇 개에 요청 대여섯 번이다(이정표는 즉시 보낸다).
 * 분당 30번이면 연달아 여러 판을 해도 걸리지 않는다.
 *
 * 기기 식별자와 접속 주소 양쪽에 건다. 식별자는 클라이언트가 지어낼 수
 * 있으므로 그것만으로는 아무것도 막지 못하고, 주소는 공용망 뒤에서 여럿이
 * 공유하므로 넉넉해야 한다.
 */
const perDevice = createRateLimiter(30, 60_000);
const perAddress = createRateLimiter(300, 60_000);

/**
 * 익명 이용 흐름을 기록한다.
 *
 * 실패해도 절대 게임을 방해하지 않는다. 잘못된 요청도 조용히 받아넘기고
 * 200을 돌려준다 — 클라이언트가 재시도하거나 오류를 띄울 이유가 없다.
 */
export async function POST(request: Request) {
  const now = Date.now();
  if (!perAddress.take(clientKey(request), now)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      deviceId?: unknown;
      events?: unknown;
    };

    const deviceId =
      typeof body.deviceId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(body.deviceId)
        ? body.deviceId
        : null;
    if (!deviceId || !Array.isArray(body.events)) {
      return NextResponse.json({ ok: true });
    }

    if (!perDevice.take(deviceId, now)) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const events = body.events
      .slice(0, MAX_EVENTS)
      .map(sanitizeEvent)
      .filter((e) => e !== null);

    if (events.length > 0) {
      await getScoreRepository().recordEvents(deviceId, events);
    }
  } catch {
    // 계측은 부수적인 일이다. 조용히 넘어간다.
  }
  return NextResponse.json({ ok: true });
}

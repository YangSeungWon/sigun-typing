import { NextResponse } from "next/server";
import { getScoreRepository } from "@/lib/db/client";
import { clientKey, createRateLimiter } from "@/lib/api/rateLimit";
import { sanitizeEvent } from "@/lib/analytics/events";
import { createDeviceChurn, isCrawler } from "@/lib/analytics/bots";

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
 * 한 주소에서 한 시간에 서로 다른 기기가 이만큼 넘게 오면 사람이 아니다.
 *
 * 통신사와 학교·회사가 여럿을 한 주소 뒤에 묶으므로 넉넉해야 한다. 지금
 * 이 서비스에 하루에 오는 사람이 열 몇이라 마흔은 아주 여유 있는 값이고,
 * 8월 10일의 그것은 한 시간에 백 개 가까이였다.
 */
const churn = createDeviceChurn(40, 60 * 60_000);

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

    /*
     * 사람이 아닌 것에 표를 달아 둔다. **버리지 않는다** — 무엇이 얼마나
     * 들어왔는지는 알아야 하고, 잘못 걸렸을 때 되돌릴 수 있어야 한다.
     * `internal`은 원래 개발·QA를 가리는 표였고, 분석에서 늘 빼는 것은
     * 같으므로 여기 함께 얹는다.
     *
     * 두 겹이다. 이름을 밝히는 봇은 UA로, 이름을 숨기는 봇은 한 주소에서
     * 기기 식별자를 갈아 끼우는 버릇으로 잡는다. 8월 10일에 하루치 통계를
     * 거꾸로 읽게 만든 것은 뒤쪽이었다.
     */
    const nonHuman =
      isCrawler(request.headers.get("user-agent")) ||
      churn.churning(clientKey(request), deviceId, now);

    const events = body.events
      .slice(0, MAX_EVENTS)
      .map(sanitizeEvent)
      .filter((e) => e !== null)
      .map((e) => (nonHuman ? { ...e, internal: true } : e));

    if (events.length > 0) {
      await getScoreRepository().recordEvents(deviceId, events);
    }
  } catch {
    // 계측은 부수적인 일이다. 조용히 넘어간다.
  }
  return NextResponse.json({ ok: true });
}

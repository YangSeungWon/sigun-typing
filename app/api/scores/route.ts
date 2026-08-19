import { NextResponse } from "next/server";
import { getCourse } from "@/data/courses";
import { getScoreRepository } from "@/lib/db/client";
import { isModeId } from "@/lib/game/modes";
import type { ModeId } from "@/lib/game/types";
import { validateSubmission } from "@/lib/score/validate";
import { SCORING_VERSION } from "@/lib/score/version";
import { isRankingPeriod, periodStart } from "@/lib/score/period";
import type { ScoreSubmission } from "@/lib/score/types";

export const dynamic = "force-dynamic";

/** 한 기기가 10분에 올릴 수 있는 기록 수. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const MAX_NICKNAME = 12;
const MAX_KEYSTROKES = 20_000;

/** 눈에 보이지 않는 문자로 순위표를 어지럽히지 못하게 한다. */
function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "").trim();
  if (name.length === 0 || name.length > MAX_NICKNAME) return null;
  return name;
}

function deviceIdOf(request: Request, body: { deviceId?: unknown }): string | null {
  const raw = body.deviceId ?? request.headers.get("x-device-id");
  if (typeof raw !== "string") return null;
  return /^[a-zA-Z0-9-]{8,64}$/.test(raw) ? raw : null;
}

export async function POST(request: Request) {
  let body: (ScoreSubmission & { deviceId?: string }) | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const nickname = cleanNickname(body.nickname);
  if (!nickname) {
    return NextResponse.json(
      { error: `이름은 1~${MAX_NICKNAME}자로 입력하세요` },
      { status: 400 },
    );
  }

  const deviceId = deviceIdOf(request, body);
  if (!deviceId) {
    return NextResponse.json({ error: "기기 식별자가 필요합니다" }, { status: 400 });
  }

  // 거대한 타임라인으로 서버를 붙잡아 두지 못하게 먼저 자른다.
  if (!Array.isArray(body.keystrokes) || body.keystrokes.length > MAX_KEYSTROKES) {
    return NextResponse.json({ error: "타건 기록이 올바르지 않습니다" }, { status: 400 });
  }
  if (!Array.isArray(body.results)) {
    return NextResponse.json({ error: "결과가 올바르지 않습니다" }, { status: 400 });
  }

  const repo = getScoreRepository();
  const now = Date.now();

  const recent = await repo.recentCount(deviceId, RATE_WINDOW_MS, now);
  if (recent >= RATE_LIMIT) {
    return NextResponse.json(
      { error: "잠시 후 다시 시도해 주세요" },
      { status: 429 },
    );
  }

  const result = validateSubmission(body, now);
  if (!result.ok) {
    /*
     * 서버 로그에도 남긴다.
     *
     * 여태 응답에만 담았는데, 화면은 그것을 펼치지 않고 로그에는 아무것도
     * 남지 않았다. 그래서 힌트를 쓴 정직한 기록이 전부 거부되던 것을 사용자가
     * 직접 말해 줄 때까지 몰랐다 — "버그로 정상 기록이 막히는 경우를 찾아야
     * 한다"고 적어 두고 찾을 방법을 두지 않았던 셈이다.
     *
     * 제출물 자체는 찍지 않는다. 사유와 코스만으로 충분하고, 타건 기록은
     * 로그에 쌓을 값이 아니다.
     */
    console.warn(
      `[score] 검증 거부 ${body.courseId}/${body.mode}:`,
      result.rejections.map((r) => `${r.code}(${r.detail})`).join(", "),
    );
    return NextResponse.json(
      { error: "기록을 검증하지 못했습니다", rejections: result.rejections },
      { status: 400 },
    );
  }

  const { score, claims } = result;
  const stored = await repo.insert({
    sessionId: claims.sessionId,
    courseId: claims.courseId,
    mode: claims.mode,
    nickname,
    deviceId,
    scoringVersion: SCORING_VERSION,
    courseVersion: claims.courseVersion,
    cpm: score.cpm,
    accuracy: score.accuracy,
    elapsedMs: score.elapsedMs,
    correctKeystrokes: score.correctKeystrokes,
    totalErrors: score.totalErrors,
    completed: score.completed,
    total: score.total,
    /* 순위의 두 번째 기준. 서버가 다시 계산한 값이지 클라이언트가 준 값이 아니다. */
    hintsUsed: score.hintsUsed,
  });

  if (!stored) {
    return NextResponse.json({ error: "이미 제출된 기록입니다" }, { status: 409 });
  }

  const board = await repo.leaderboard(
    claims.courseId,
    claims.mode,
    100,
    SCORING_VERSION,
    claims.courseVersion,
  );
  const rank = board.findIndex((e) => e.cpm <= score.cpm) + 1;

  return NextResponse.json({
    ok: true,
    score,
    rank: rank > 0 ? rank : null,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("course") ?? "";
  const mode = url.searchParams.get("mode") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);

  if (!getCourse(courseId)) {
    return NextResponse.json({ error: "없는 코스입니다" }, { status: 400 });
  }
  if (!isModeId(mode)) {
    return NextResponse.json({ error: "없는 모드입니다" }, { status: 400 });
  }

  const rawPeriod = url.searchParams.get("period") ?? "all";
  const period = isRankingPeriod(rawPeriod) ? rawPeriod : "all";

  const entries = await getScoreRepository().leaderboard(
    courseId,
    mode as ModeId,
    limit,
    SCORING_VERSION,
    // 지금 배포된 코스 판번호의 기록만 보여준다.
    getCourse(courseId)!.version,
    periodStart(period, Date.now()),
  );
  return NextResponse.json({ entries, period });
}

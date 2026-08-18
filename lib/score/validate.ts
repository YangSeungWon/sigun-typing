import { getCourse } from "@/data/courses";
import { computeScore } from "./core";
import { keystrokeCount } from "../hangul/keystrokes";
import { createGame } from "../game/engine";
import { MODES, isModeId } from "../game/modes";
import type { Keystroke, Score } from "../game/types";
import { verifyToken } from "./session";
import type { Rejection, ScoreSubmission, ValidationResult } from "./types";

/**
 * 클라이언트가 보낸 타건 기록을 서버에서 다시 계산해 검증한다.
 *
 * 원칙: 클라이언트가 보낸 점수는 **읽지 않고 다시 계산한다.** claimed는 오직
 * 서버 계산값과 어긋나는지 확인하는 용도로만 쓴다. 어긋나면 조작이거나 버그이고,
 * 둘 다 랭킹에 올려서는 안 된다.
 */

/** 사람이 낼 수 있는 타수의 상한. 한글 타자 최고 기록도 1000타를 크게 넘지 않는다. */
export const MAX_PLAUSIBLE_CPM = 1_500;

/** 서로 다른 키를 이보다 빨리 연속으로 누를 수는 없다. */
export const MIN_INTERVAL_MS = 12;

/** 이 비율을 넘게 최소 간격에 붙어 있으면 사람 손이 아니다. */
const MAX_FAST_RATIO = 0.1;

/** 타건 간격의 변동계수가 이보다 작으면 기계적으로 일정한 리듬이다. */
const MIN_RHYTHM_CV = 0.08;

/** 리듬 검사를 신뢰할 수 있는 최소 표본 수. */
const RHYTHM_MIN_SAMPLES = 30;

/** 시계 오차와 네트워크 지연을 감안한 여유. */
const CLOCK_TOLERANCE_MS = 3_000;

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 변동계수(표준편차/평균). 사람은 대략 0.4~1.0, 매크로는 0에 가깝다. */
function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance) / m;
}

/**
 * @param submission 클라이언트 제출물
 * @param now 제출이 도착한 서버 시각
 */
export function validateSubmission(
  submission: ScoreSubmission,
  now: number,
): ValidationResult {
  const rejections: Rejection[] = [];
  const reject = (code: Rejection["code"], detail: string) =>
    rejections.push({ code, detail });

  const claims = verifyToken(submission.token, now);
  if (!claims) {
    // 토큰이 없으면 나머지를 검사할 기준 자체가 없다.
    return { ok: false, rejections: [{ code: "bad_token", detail: "토큰이 유효하지 않거나 만료되었습니다" }] };
  }

  if (!isModeId(submission.mode) || submission.mode !== claims.mode) {
    reject("mode_mismatch", `토큰의 모드는 ${claims.mode}입니다`);
  }
  if (submission.courseId !== claims.courseId) {
    reject("course_mismatch", `토큰의 코스는 ${claims.courseId}입니다`);
  }
  if (submission.seed !== claims.seed) {
    reject("course_mismatch", "시드가 토큰과 다릅니다");
  }

  const course = getCourse(claims.courseId);
  if (!course) {
    return { ok: false, rejections: [{ code: "unknown_course", detail: claims.courseId }] };
  }

  /*
   * 판을 시작한 뒤 배포로 코스가 바뀌면 문제 집합이 달라진다. 그 판의 결과를
   * 새 판번호 순위표에 올리면 서로 다른 문제를 푼 기록이 섞인다.
   */
  if (claims.courseVersion !== course.version) {
    reject(
      "course_version_mismatch",
      `시작 당시 코스는 v${claims.courseVersion}, 지금은 v${course.version}입니다`,
    );
  }

  const { results, keystrokes } = submission;
  if (results.length === 0) {
    reject("empty_run", "결과가 비어 있습니다");
  }

  // 토큰의 시드로 순서를 그대로 재현해 제출된 결과와 대조한다.
  // 이렇게 하면 쉬운 지역만 골라 담은 결과를 걸러낼 수 있다.
  const config = MODES[claims.mode];
  const expected = createGame(
    course.regions.map((r) => ({ id: r.code, answer: r.name, aliases: r.aliases })),
    config,
    claims.issuedAt,
    claims.seed,
  ).items;

  results.forEach((result, i) => {
    const item = expected[i];
    if (!item) {
      reject("unknown_region", `${i + 1}번째 결과가 코스 길이를 넘습니다`);
      return;
    }
    if (item.id !== result.id) {
      reject("unknown_region", `${i + 1}번째는 ${item.answer}여야 합니다`);
    }
  });

  // 각 항목의 정답 타수는 지역명에서 결정된다. 부풀릴 여지를 주지 않는다.
  let serverKeystrokes = 0;
  for (const result of results) {
    if (result.skipped) continue;
    const item = expected.find((it) => it.id === result.id);
    if (!item) continue;
    /*
     * 별칭으로 맞힐 수 있으므로 상한은 인정되는 표기 중 가장 긴 것이다.
     * 대표 표기만 보면 `제주특별자치도`로 맞힌 사람이 거부된다.
     */
    const exact = Math.max(
      ...[item.answer, ...(item.aliases ?? [])].map((a) => keystrokeCount(a)),
    );
    if (result.keystrokes > exact) {
      reject(
        "keystroke_mismatch",
        `${item.answer}의 타수는 최대 ${exact}이나 ${result.keystrokes}로 제출되었습니다`,
      );
    }
    serverKeystrokes += Math.min(result.keystrokes, exact);
  }

  const timeline = analyzeTimeline(keystrokes, reject);

  /**
   * 힌트 페널티는 서버가 직접 더한다. 클라이언트가 계산해 온 시간을 믿으면
   * 페널티를 빼고 보내는 것을 막을 수 없다.
   * 항목 수를 넘는 힌트는 있을 수 없으므로 그 선에서 자른다.
   */
  const hintsAllowed = config.allowHint ? results.length : 0;
  const hintsUsed = Math.min(
    Math.max(0, Math.floor(Number(submission.hintsUsed) || 0)),
    hintsAllowed,
  );
  /*
   * 기록에 남는 시간은 **실제로 흐른 시간 하나뿐이다.**
   *
   * 한때 여기에 힌트 페널티를 얹었다. 그러면 흐른 적이 없는 시간이 섞이므로
   * 벽시계와 견줄 수 없게 되고, 실제로 힌트를 쓴 정직한 기록이 전부 거부된
   * 적이 있다. 지금은 힌트를 시간에 얹지 않으므로 그런 구분 자체가 없다.
   */
  const elapsedMs = Math.max(
    results.reduce((a, r) => a + Math.max(0, r.elapsedMs), 0),
    timeline.span,
  );

  // 서버가 토큰을 발급한 뒤 실제로 흐른 시간보다 오래 플레이할 수는 없다.
  const wallclock = now - claims.issuedAt;
  if (elapsedMs > wallclock + CLOCK_TOLERANCE_MS) {
    reject(
      "elapsed_exceeds_wallclock",
      `주장한 경과 ${elapsedMs}ms가 실제 경과 ${wallclock}ms보다 깁니다`,
    );
  }

  /*
   * 브라우저와 똑같은 규칙으로 계산한다. 규칙이 갈라지면 정직한 기록이
   * score_mismatch로 거부된다.
   *
   * 정확도는 곳 기준이므로(끝낸 곳 중 한 번에 맞힌 비율) 타건 기록이 필요
   * 없다. 그 기록은 사람의 리듬인지 보는 데만 쓴다(analyzeTimeline).
   */
  const serverScore: Score = computeScore({
    correctKeystrokes: serverKeystrokes,
    elapsedMs,
    totalErrors: results.reduce((a, r) => a + Math.max(0, r.errors), 0),
    completed: results.filter((r) => !r.skipped).length,
    total: course.regions.length,
    hintsUsed,
    /*
     * 시도 횟수는 클라이언트가 보낸 값이라 타수처럼 다시 계산할 수 없다.
     * 순위는 타수로 매겨지고 정답률은 화면에 보여 주는 값이라, 여기서
     * 부풀린다고 순위가 올라가지는 않는다. 없으면 한 번에 맞힌 것으로 본다 —
     * 이 필드가 생기기 전에 시작한 판이 그렇게 도착한다.
     */
    firstTry: results.filter((r) => !r.skipped && (r.attempts ?? 1) <= 1).length,
  });

  if (serverScore.cpm > MAX_PLAUSIBLE_CPM) {
    reject("too_fast", `${Math.round(serverScore.cpm)}타/분은 사람의 범위를 벗어납니다`);
  }

  // 클라이언트 주장과 서버 계산이 다르면 둘 중 하나가 틀린 것이다.
  const claimed = submission.claimed;
  if (claimed && Math.abs(claimed.correctKeystrokes - serverKeystrokes) > 0) {
    reject(
      "score_mismatch",
      `주장 ${claimed.correctKeystrokes}타 / 서버 계산 ${serverKeystrokes}타`,
    );
  }

  if (rejections.length > 0) return { ok: false, rejections };
  return { ok: true, score: serverScore, claims };
}

/** 타임라인 자체의 물리적 타당성을 본다. */
function analyzeTimeline(
  keystrokes: Keystroke[],
  reject: (code: Rejection["code"], detail: string) => void,
) {
  if (keystrokes.length === 0) return { span: 0 };

  const times = keystrokes.map((k) => k.t);
  if (times.some((t) => !Number.isFinite(t) || t < 0)) {
    reject("time_travel", "타건 시각에 음수나 비정상 값이 있습니다");
    return { span: 0 };
  }
  for (let i = 1; i < times.length; i++) {
    if (times[i] < times[i - 1]) {
      reject("time_travel", `타건 시각이 되돌아갑니다 (${times[i - 1]} → ${times[i]})`);
      return { span: 0 };
    }
  }

  // 새 글자를 실제로 입력한 이벤트 사이의 간격만 본다. 지우기는 리듬이 다르다.
  const typingTimes = keystrokes.filter((k) => k.n > 0).map((k) => k.t);
  const intervals: number[] = [];
  for (let i = 1; i < typingTimes.length; i++) {
    intervals.push(typingTimes[i] - typingTimes[i - 1]);
  }

  if (intervals.length >= RHYTHM_MIN_SAMPLES) {
    const tooFast = intervals.filter((d) => d < MIN_INTERVAL_MS).length;
    if (tooFast / intervals.length > MAX_FAST_RATIO) {
      reject(
        "impossible_interval",
        `타건 간격의 ${Math.round((tooFast / intervals.length) * 100)}%가 ${MIN_INTERVAL_MS}ms 미만입니다`,
      );
    }

    const cv = coefficientOfVariation(intervals);
    if (cv < MIN_RHYTHM_CV) {
      reject("robotic_rhythm", `타건 간격이 지나치게 일정합니다 (변동계수 ${cv.toFixed(3)})`);
    }
  }

  return { span: times[times.length - 1] - times[0] };
}

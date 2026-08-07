import type { ItemResult, Keystroke, ModeId, Score } from "../game/types";

/** 클라이언트가 기록을 제출할 때 보내는 것 전부. */
export interface ScoreSubmission {
  /** 서버가 발급한 시작 토큰 */
  token: string;
  courseId: string;
  mode: ModeId;
  seed: number;
  nickname: string;
  keystrokes: Keystroke[];
  results: ItemResult[];
  /** 초성 힌트를 쓴 횟수. 서버가 이 값만큼 기록에 시간을 더한다. */
  hintsUsed?: number;
  /** 클라이언트가 주장하는 점수. 검증 후 서버 계산값으로 대체된다. */
  claimed: Score;
}

/** 시작 토큰에 담기는 내용. 서명되어 클라이언트가 고칠 수 없다. */
export interface SessionClaims {
  sessionId: string;
  courseId: string;
  /** 발급 당시 코스 판번호. 배포로 코스가 바뀌면 옛 판의 기록과 섞이지 않는다. */
  courseVersion: number;
  mode: ModeId;
  seed: number;
  /** 서버 시각 기준 발급 시점 */
  issuedAt: number;
}

export type RejectionCode =
  | "bad_token"
  | "token_expired"
  | "unknown_course"
  | "mode_mismatch"
  | "course_mismatch"
  | "course_version_mismatch"
  | "empty_run"
  | "unknown_region"
  | "keystroke_mismatch"
  | "score_mismatch"
  | "time_travel"
  | "too_fast"
  | "impossible_interval"
  | "robotic_rhythm"
  | "elapsed_exceeds_wallclock";

export interface Rejection {
  code: RejectionCode;
  detail: string;
}

export type ValidationResult =
  | { ok: true; score: Score; claims: SessionClaims }
  | { ok: false; rejections: Rejection[] };

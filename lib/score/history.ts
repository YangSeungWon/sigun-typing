import { readJson, writeJson } from "../storage";
import type { ModeId } from "../game/types";

/**
 * 지나온 판들.
 *
 * 개인 최고 기록은 **값 하나**다. 좋아진 순간만 갱신되므로 "지금 잘하고 있나"에는
 * 답하지만 "늘고 있나"에는 답하지 못한다. 41초가 첫 판인지 스무 번째인지,
 * 지난주에는 몇 초였는지를 화면이 모른다.
 *
 * 타자 연습이 사람을 붙잡아 두는 힘은 대부분 거기서 나온다 — 오늘 380타,
 * 지난달 310타. 곡선을 그리려면 점이 있어야 하고, 점을 남기는 곳이 여기다.
 *
 * ── 서버에도 있는데 왜 기기에 남기나 ────────────────────────
 * `scores` 표에 device_id와 시각이 이미 쌓여 있다. 다만 **랭킹에 올린 판만**
 * 들어간다. 안 올린 판, 연습 판, 이름 보고 익히기는 통째로 빠지므로 그것만으로는
 * 곡선에 구멍이 난다. 여기는 끝낸 판을 전부 받는다.
 *
 * 계정을 들이지 않는다. 기기를 바꾸면 곡선이 끊기는데, 그건 막을 값보다 사람을
 * 식별하기 시작하는 값이 크다(`app/(site)/privacy/page.tsx`가 회원가입이 없다고
 * 약속하고 있다).
 */

const KEY = "sigun:runs:v1";

/**
 * 코스·모드마다 남길 판 수.
 *
 * 곡선을 그리는 데는 이보다 적어도 되지만, 너무 짧으면 어제까지 잘하다 오늘
 * 한 판 망친 사람의 곡선이 통째로 아래로 보인다. 반대로 무한히 쌓으면 저장소가
 * 자란다 — 서른 판이면 몇 주치다.
 */
export const KEEP = 30;

export interface RunRecord {
  courseId: string;
  mode: ModeId;
  elapsedMs: number;
  completed: number;
  total: number;
  hintsUsed: number;
  /** 끝난 시각. 곡선의 가로축이다. */
  at: number;
}

function accept(raw: unknown): RunRecord[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((r): r is RunRecord => {
    if (typeof r !== "object" || r === null) return false;
    const v = r as Record<string, unknown>;
    return (
      typeof v.courseId === "string" &&
      typeof v.mode === "string" &&
      typeof v.elapsedMs === "number" &&
      typeof v.completed === "number" &&
      typeof v.total === "number" &&
      typeof v.hintsUsed === "number" &&
      typeof v.at === "number"
    );
  });
}

export function loadRuns(): RunRecord[] {
  return readJson(KEY, accept) ?? [];
}

/**
 * 한 판을 더한다.
 *
 * 코스·모드별로 최근 것만 남긴다. 전체를 한 통에 넣고 자르면 전국을 한 판 돌 때
 * 서울 기록이 밀려 나간다 — 코스마다 하는 빈도가 다르다.
 */
export function addRun(run: RunRecord): RunRecord[] {
  const all = [...loadRuns(), run];
  const kept: RunRecord[] = [];
  const seen = new Map<string, number>();
  // 뒤에서부터 세어 각 코스·모드의 최근 KEEP개만 남긴다.
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i];
    const key = `${r.courseId}:${r.mode}`;
    const n = seen.get(key) ?? 0;
    if (n >= KEEP) continue;
    seen.set(key, n + 1);
    kept.push(r);
  }
  kept.reverse();
  writeJson(KEY, kept);
  return kept;
}

/** 한 코스·모드의 판들. 오래된 것부터. */
export function runsOf(runs: RunRecord[], courseId: string, mode: ModeId): RunRecord[] {
  return runs.filter((r) => r.courseId === courseId && r.mode === mode);
}

import { readJson, writeJson } from "../storage";
import { emptyState, MAX_TRIES, type Closeness, type QuizState } from "./quiz";

/**
 * 오늘 푼 판을 기기에 남긴다.
 *
 * 하루에 한 번이므로 되돌아왔을 때 다시 풀리면 안 된다. 새로고침하면 처음부터
 * 라면 그건 하루 한 번이 아니라 그냥 무한이다.
 *
 * **서버에 안 남긴다.** 순위가 걸린 값이 아니고, 이걸 남기려면 사람을 식별해야
 * 한다. 기기를 바꾸면 그날 판을 다시 풀 수 있는데, 그건 막을 값보다 계정을
 * 들이는 값이 크다.
 *
 * 날이 바뀌면 버린다. 어제 판을 들고 있어도 쓸 데가 없고, 쌓이면 저장소만 먹는다.
 */
const KEY = "sigun:daily:v1";

function accept(raw: unknown): QuizState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.day !== "number" || typeof v.solved !== "boolean") return null;
  if (!Array.isArray(v.sidoPicks) || !Array.isArray(v.guesses)) return null;

  const sidoPicks = v.sidoPicks.filter((x): x is string => typeof x === "string");
  const guesses = v.guesses
    .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
    .map((g) => ({ name: g.name, closeness: g.closeness }))
    .filter(
      (g): g is { name: string; closeness: Closeness } =>
        typeof g.name === "string" &&
        (g.closeness === "hit" || g.closeness === "near" || g.closeness === "far"),
    )
    // 손댄 값이 여섯 번을 넘겨 들어오면 잘라 낸다. 격자가 길어질 뿐이다.
    .slice(0, MAX_TRIES);

  return { day: v.day, sidoPicks, guesses, solved: v.solved };
}

/** 오늘 것이면 돌려주고, 어제 것이거나 없으면 새 판을 준다. */
export function loadQuiz(day: number): QuizState {
  const saved = readJson(KEY, accept);
  return saved && saved.day === day ? saved : emptyState(day);
}

export function saveQuiz(state: QuizState): void {
  writeJson(KEY, state);
}

import type { NewErrorRow } from "../db/schema";

/**
 * 오류 기록.
 *
 * 원칙 둘.
 *
 * 1. **기록하다가 게임을 죽이지 않는다.** 오류를 남기려다 오류가 나면
 *    아무 일도 없었던 것처럼 넘어간다. 이 코드가 서비스보다 중요할 수는 없다.
 * 2. **개인정보를 담지 않는다.** 요청 본문도, 입력한 지명도, 쿠키도 남기지
 *    않는다. 필요한 것은 "어디서 무엇이 몇 번 터졌는가"이지 "누가 무엇을
 *    쳤는가"가 아니다. 주소는 경로만 남기고 질의 문자열은 뗀다 —
 *    도전장 링크에는 닉네임이 실려 있다.
 */

/** 한 줄이 길어져도 로그와 DB를 채울 이유는 없다. */
const MAX_MESSAGE = 500;
const MAX_STACK = 4_000;

export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "알 수 없는 오류";
}

export function digestOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "digest" in error) {
    return String((error as { digest: unknown }).digest);
  }
  return undefined;
}

/** 질의 문자열을 뗀 경로. 거기에는 닉네임과 기록이 실려 있다. */
export function cleanPath(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const path = raw.split("?")[0].split("#")[0];
  return path.slice(0, 200) || undefined;
}

function clamp(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function toErrorRow(input: {
  source: "server" | "client";
  error?: unknown;
  message?: string;
  digest?: string;
  stack?: string;
  path?: string | null;
  kind?: string;
}): NewErrorRow {
  const message = input.message ?? messageOf(input.error);
  return {
    source: input.source,
    message: clamp(message, MAX_MESSAGE) ?? "알 수 없는 오류",
    digest: clamp(input.digest ?? digestOf(input.error), 100),
    stack: clamp(
      input.stack ?? (input.error instanceof Error ? input.error.stack : undefined),
      MAX_STACK,
    ),
    path: cleanPath(input.path),
    kind: clamp(input.kind, 40),
  };
}

/**
 * 컨테이너 로그에도 남긴다.
 *
 * DB가 죽어서 터진 경우에는 DB에 못 남기므로, 어떤 상황에서도 남는 경로가
 * 하나는 있어야 한다. `[error]`로 시작하게 해서 grep 한 번에 잡히게 한다.
 */
export function logError(row: NewErrorRow): void {
  const where = [row.source, row.kind, row.path].filter(Boolean).join(" ");
  process.stderr.write(`[error] ${where} — ${row.message}\n`);
}

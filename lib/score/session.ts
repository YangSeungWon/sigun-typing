import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SessionClaims } from "./types";

/**
 * 시작 토큰. 게임을 시작할 때 서버가 발급하고, 제출할 때 되돌려 받는다.
 *
 * 이게 없으면 클라이언트가 "1초 만에 31개를 쳤다"는 타임라인을 통째로 지어내도
 * 서버는 반박할 근거가 없다. 발급 시각을 서명해 두면 제출이 도착한 서버 시각과
 * 비교해 "주장한 경과 시간이 실제로 흐른 시간보다 길 수는 없다"를 검사할 수 있다.
 */

/** 토큰 유효 시간. 이보다 오래 걸리는 판은 없다고 본다. */
export const TOKEN_TTL_MS = 60 * 60 * 1000;

function secret(): string {
  const value = process.env.SCORE_SECRET;
  if (!value) {
    // 운영에서 비밀키 없이 뜨면 랭킹 전체가 위조 가능해진다. 조용히 넘어가지 않는다.
    if (process.env.NODE_ENV === "production") {
      throw new Error("SCORE_SECRET이 설정되지 않았습니다");
    }
    return "dev-only-insecure-secret";
  }
  return value;
}

/**
 * 비밀키의 지문. 비밀키 자체는 절대 로그에 남기지 않는다.
 *
 * 웹과 소켓이 **서로 다른** 비밀키를 갖고 있어도 둘 다 멀쩡히 뜬다. 그러다
 * 멀티로 완주한 사람의 기록만 서명 오류로 거부되는데, 이건 알아채기 가장
 * 어려운 형태의 고장이다. 두 서비스가 부팅할 때 같은 지문을 찍어 두면
 * 로그 두 줄을 눈으로 대조하는 것만으로 끝난다.
 */
export function secretFingerprint(): string {
  return createHash("sha256").update(secret()).digest("hex").slice(0, 8);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueToken(
  input: Omit<SessionClaims, "sessionId" | "issuedAt">,
  now: number,
): { token: string; claims: SessionClaims } {
  const claims: SessionClaims = {
    ...input,
    sessionId: randomUUID(),
    issuedAt: now,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, claims };
}

/** 서명이 맞고 만료되지 않았으면 claims를, 아니면 null을 돌려준다. */
export function verifyToken(token: string, now: number): SessionClaims | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  // 길이가 다르면 timingSafeEqual이 던지므로 먼저 거른다.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof claims.issuedAt !== "number") return null;
  if (now - claims.issuedAt > TOKEN_TTL_MS) return null;
  // 서버 시계가 뒤로 간 게 아니라면 미래에 발급된 토큰은 없다.
  if (claims.issuedAt - now > 5_000) return null;

  return claims;
}

import { timingSafeEqual } from "node:crypto";

/**
 * 관리자 문의 열쇠.
 *
 * 로그인은 만들지 않는다. 쓸 사람이 한 명이고 쓰는 일은 어쩌다 한 번이라,
 * 로그인을 만들면 그 로그인이 또 지켜야 할 문이 된다 — 세션, 만료, 비밀번호
 * 재설정. 헤더 한 줄이면 `curl`로도 화면으로도 쓸 수 있다.
 *
 * 토큰을 안 심었으면 **문이 아예 없는 것으로 동작한다.** 빈 값과 빈 헤더가
 * 우연히 같아져서 아무나 들어오는 일은 없어야 한다.
 */
export function isAdmin(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 16) return false;

  const got = request.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  // 길이가 다르면 비교 자체가 던진다. 길이도 비밀의 일부라 먼저 재지 않는다.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 문이 있다는 것도 알려 주지 않는다. 권한 없음이 아니라 없는 주소로 답한다. */
export const NOT_FOUND = { error: "Not found" } as const;

/**
 * 서버가 뜰 때 한 번 실행된다.
 *
 * 여기서 하는 일은 하나 — 기록 서명 비밀키의 지문을 남기는 것이다.
 * 소켓 서버도 같은 줄을 찍으므로, 둘이 다르면 로그 두 줄만 비교하면 된다.
 * (비밀키가 아예 없으면 여기서 던져 컨테이너가 뜨지 않는다.)
 */
export async function register() {
  // Edge 런타임에는 node:crypto가 없다. 서명은 Node 런타임에서만 일어난다.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { secretFingerprint } = await import("./lib/score/session");
  process.stdout.write(`[web] 기록 서명 키 지문 ${secretFingerprint()}\n`);
}

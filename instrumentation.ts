import type { Instrumentation } from "next";

/**
 * 서버가 뜰 때 한 번 실행된다.
 *
 * 여기서 하는 일은 하나 — 기록 서명 비밀키의 지문을 남기는 것이다.
 * 소켓 서버도 같은 줄을 찍으므로, 둘이 다르면 로그 두 줄만 비교하면 된다.
 * (비밀키가 아예 없으면 여기서 던져 컨테이너가 뜨지 않는다.)
 */
export async function register() {
  // Edge 런타임에는 node:crypto도 process.stdout도 없다. 서명은 Node에서만 한다.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logBoot } = await import("./lib/observability/boot");
  logBoot();
}

/**
 * 서버에서 터진 오류를 남긴다.
 *
 * 이게 없으면 500이 나도 아무도 모른다. 관측 기간에 숫자가 이상할 때
 * "사람들이 안 하는 것"과 "터진 것"을 구분할 방법이 있어야 한다.
 *
 * 로그와 DB 양쪽에 남기는 이유: DB가 죽어서 터진 경우에는 DB에 못 남긴다.
 * 어떤 상황에서도 남는 경로가 하나는 있어야 한다.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { toErrorRow, logError } = await import("./lib/observability/report");
  const row = toErrorRow({
    source: "server",
    error,
    path: request.path,
    kind: context.routeType,
  });

  logError(row);

  try {
    const { getScoreRepository } = await import("./lib/db/client");
    await getScoreRepository().recordError(row);
  } catch {
    // 오류를 남기다 난 오류까지 좇지는 않는다. 로그에는 이미 나갔다.
  }
};

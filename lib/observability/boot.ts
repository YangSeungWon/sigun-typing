import { secretFingerprint } from "../score/session";

/**
 * 부팅 한 줄.
 *
 * instrumentation.ts에 직접 두면 Turbopack이 Edge 번들까지 훑으면서
 * "Edge에는 process.stdout이 없다"고 경고한다. 실행 시점에는 Node에서만
 * 도는 코드지만 정적 분석은 그걸 모른다. 빌드 로그의 소음은 진짜 문제를
 * 가리므로, Node 전용 코드는 동적으로 불러오는 파일에 둔다.
 */
export function logBoot(): void {
  process.stdout.write(`[web] 기록 서명 키 지문 ${secretFingerprint()}\n`);
}

/**
 * vitest는 vite 위에서 돌아가므로 import.meta.glob을 쓸 수 있다.
 * 앱 번들에는 들어가지 않고 테스트에서만 쓴다.
 */
interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
    options?: { eager?: boolean },
  ): Record<string, T>;
}

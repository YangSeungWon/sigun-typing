"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * 하이드레이션이 끝났는지.
 *
 * localStorage처럼 서버에 없는 값을 첫 렌더에서 읽으면 서버 HTML과 클라이언트가
 * 어긋나 하이드레이션이 깨진다(React #418). 서버 스냅샷을 false로 두면 양쪽이
 * 같은 것을 그리고, 하이드레이션이 끝난 뒤에 한 번 다시 그린다.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

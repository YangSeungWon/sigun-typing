"use client";

import { useEffect } from "react";

/**
 * 이 화면이 도는 동안 사이트의 껍데기를 걷는다.
 *
 * 판이 도는 화면에 탭 바가 깔리면 지도 아래가 메뉴가 되고, 판 도중에 나가는
 * 문이 엄지 밑에 넷 생긴다. `/play`와 `/review`는 셸 밖에 두어 라우트 구조로
 * 해결했지만 대결은 그럴 수 없다 — 방을 만드는 화면과 경주하는 화면이 같은
 * 주소에 있다.
 *
 * 반드시 풀려야 한다. 표시가 낀 채로 남으면 사이트 전체에서 네비가 사라지고
 * 브라우저 뒤로 가기 말고는 돌아올 길이 없다. 그래서 정리를 effect의 반환값에
 * 둔다 — 언마운트든 주소 이동이든 React가 같은 자리에서 부른다.
 */
export function useImmersive(active = true) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.dataset.immersive = "1";
    return () => {
      delete document.documentElement.dataset.immersive;
    };
  }, [active]);
}

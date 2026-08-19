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

/**
 * 푸터만 걷는다.
 *
 * 대기실은 판이 도는 화면이 아니라 친구를 기다리는 빈 시간이다. 헤더도 탭
 * 바도 그대로 있어야 하고(잠깐 다른 데 다녀올 수 있는 자리다), 실제로 나갔다
 * 와도 방은 안 죽는다. 걷어 낼 것은 푸터 하나뿐이다 — 방 코드를 친구에게
 * 부르는 화면 아래에 행정구역 데이터 출처가 붙어 있을 이유가 없다.
 *
 * `useImmersive`와 표시를 따로 쓴다. 하나로 묶고 단계를 나누면 둘 중 하나가
 * 풀릴 때 다른 하나까지 같이 풀리는 자리가 생긴다. 대결에서는 대기실(이것)과
 * 경주(저것)가 잇따라 켜졌다 꺼지므로 그 얽힘이 실제로 일어난다.
 *
 * 정리를 effect의 반환값에 두는 이유는 위와 같다. 표시가 낀 채로 남으면
 * 사이트 전체에서 푸터가 사라진다.
 */
export function useHideFooter(active = true) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.dataset.hideFooter = "1";
    return () => {
      delete document.documentElement.dataset.hideFooter;
    };
  }, [active]);
}

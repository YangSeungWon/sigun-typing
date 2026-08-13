/**
 * 사이트를 돌아다니는 길.
 *
 * 여태 전역 이동 수단이 없었다. 첫 화면 아래 링크 한 줄이 그 자리를 대신했는데,
 * 첫 화면이 코스 목록이던 동안은 그걸로 됐다 — 어디에 있든 뒤로 가면 목록이었다.
 * 첫 화면이 상태판이 되면 그 전제가 깨진다. 코스를 고르러 갈 길이 따로 있어야 한다.
 *
 * 마크업은 셋으로 나뉜다(넓은 화면 헤더 · 좁은 화면 헤더 · 아래 탭 바). 하나를
 * CSS로 비틀어 셋처럼 보이게 만드는 것보다 낫다고 판단한 자리다. 대신 **무엇이
 * 어디로 가는가는 여기 한 번만** 적는다 — 나뉘어도 되는 것은 생김새지 규칙이 아니다.
 */
export interface NavItem {
  href: string;
  label: string;
}

/** 넓은 화면 헤더 오른쪽. */
export const HEADER_LINKS: readonly NavItem[] = [
  { href: "/courses", label: "코스" },
  { href: "/notes", label: "기록" },
  { href: "/rooms", label: "대결" },
  { href: "/ranking", label: "랭킹" },
  { href: "/guide", label: "이용안내" },
];

/**
 * 좁은 화면 아래 탭. 넷으로 고정한다 — 다섯 번째가 생기면 그건 탭이 아니라 메뉴다.
 *
 * 랭킹과 이용안내는 여기 없다. 랭킹은 남의 기록이라 내 기록 안에서 이어 보면 되고,
 * 이용안내는 한 번 읽고 마는 문서라 늘 엄지 밑에 있을 이유가 없다.
 */
export const TAB_ITEMS: readonly NavItem[] = [
  { href: "/", label: "홈" },
  { href: "/courses", label: "도전" },
  { href: "/rooms", label: "대결" },
  { href: "/notes", label: "기록" },
];

/**
 * 지금 이 탭에 있는가.
 *
 * `/`만 정확히 일치할 때로 제한한다. 앞뒤로 걸치면 모든 주소가 홈을 켜서
 * 탭 두 개가 동시에 켜진 채로 다닌다. 나머지는 하위 경로까지 자기 것으로
 * 친다 — `/courses/seoul`에 있는 사람은 도전 탭에 있는 것이 맞다.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

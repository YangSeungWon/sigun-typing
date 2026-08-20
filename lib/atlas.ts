/**
 * 옆 사이트로 가는 문.
 *
 * quiz-korea.ysw.kr은 같은 지도를 **반대 방향**으로 묻는다 — 여기는 지도를
 * 보고 이름을 치고, 거기는 이름을 보고 지도에서 찾는다. 게다가 학습 모드와
 * 인쇄용 백지도 PDF가 있는데, 둘 다 이 사이트에 없는 물건이다.
 *
 * 그래서 서로 뺏는 관계가 아니다. 여기서 막히는 지점(지명이 아예 안 떠오른다)이
 * 거기서 푸는 문제이고, 거기서 막히는 지점(위치는 아는데 이름이 안 나온다)이
 * 여기서 푸는 문제다.
 *
 * ── 어디에 놓는가 ─────────────────────────────────────────
 * 푸터나 첫 화면에는 안 붙인다. 사이트 전체에 박아 두면 링크 교환으로 읽히고,
 * 정작 필요한 사람에게는 안 닿는다. 이미 "이 지역을 자꾸 틀린다"가 화면에
 * 떠 있는 자리에만 둔다.
 */
const ATLAS = "https://quiz-korea.ysw.kr";

/** 자치구가 있는 광역시. 저쪽에서는 시군구로 분류된다. */
const METRO = new Set(["seoul", "busan", "daegu", "incheon", "gwangju", "daejeon", "ulsan"]);

/** 시군을 두는 도. 저쪽에서는 시군이다. */
const PROVINCE = new Set([
  "gyeonggi",
  "gangwon",
  "chungbuk",
  "chungnam",
  "jeonbuk",
  "jeonnam",
  "gyeongbuk",
  "gyeongnam",
  "jeju",
]);

/**
 * 이 코스를 지도에서 익힐 수 있는 주소.
 *
 * 읍면동 코스(`gangwon-chuncheon`)는 저쪽에 대응이 없으므로 그 시도의 학습
 * 지도로 보낸다 — 춘천시 동을 헷갈리는 사람에게 강원 시군 지도는 한 단계
 * 위지만, 아무 데도 안 보내는 것보다 낫다.
 *
 * 세종은 저쪽에 학습 페이지가 없다(시군도 시군구도 404). 없는 곳으로 보내느니
 * 문을 안 여는 쪽이 낫다.
 */
export function atlasLearnUrl(courseId: string, from: string): string | null {
  const path = learnPath(courseId);
  if (!path) return null;
  /*
   * 어디서 넘어왔는지를 싣는다. 안 넘어갈 때 문구 문제인지 자리 문제인지
   * 갈리지 않으면 고칠 수가 없다.
   */
  return `${ATLAS}${path}?utm_source=sigun-typing&utm_medium=${from}`;
}

function learnPath(courseId: string): string | null {
  if (courseId === "sido") return "/ko/learn/sido/";
  if (courseId === "nationwide") return "/ko/learn/sigun/";
  const base = courseId.split("-")[0];
  if (METRO.has(base)) return `/ko/learn/sigungu/${base}/`;
  if (PROVINCE.has(base)) return `/ko/learn/sigun/${base}/`;
  return null;
}

/** 인쇄용 백지도. 이 사이트에는 아예 없는 물건이라 겹치지 않는다. */
export const ATLAS_BLANK_MAPS = {
  sido: `${ATLAS}/ko/maps/sido/?utm_source=sigun-typing&utm_medium=guide`,
  sigun: `${ATLAS}/ko/maps/sigun/?utm_source=sigun-typing&utm_medium=guide`,
};

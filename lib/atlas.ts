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
 * 문맥이 있는 자리 둘과 푸터 하나.
 *
 * 문맥 있는 자리는 "이 지역을 자꾸 틀린다"가 이미 화면에 떠 있는 곳이다
 * (헷갈리는 지역, 이용안내). 거기서는 코스에 맞는 지도로 바로 보낸다.
 *
 * 푸터는 다른 이유다. 문맥 있는 자리는 이미 막힌 사람만 만나므로, 그냥
 * 옆에 뭐가 있는지 아는 길이 하나도 없다. 대신 그 자리에서는 아무것도
 * 권하지 않는다 — 약관 옆에 이름만 걸어 둔다.
 */
const ATLAS = "https://quiz-korea.ysw.kr";

/** 푸터에서 이름만 걸어 두는 자리. 어디서 왔는지는 여기서도 싣는다. */
export const ATLAS_HOME = `${ATLAS}/ko/?utm_source=sigun-typing&utm_medium=footer`;

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
 * 읍면동 코스는 저쪽에도 있다(동 코스 252개가 전부 대응된다). 시군구 코드를
 * 넘겨 주면 그 동 지도로 바로 가고, 안 넘기면 그 시도의 시군 지도로 한 단계
 * 올라간다.
 *
 * 세종은 저쪽에 학습 페이지가 없다(시군도 시군구도 404). 없는 곳으로 보내느니
 * 문을 안 여는 쪽이 낫다.
 */
export function atlasLearnUrl(
  courseId: string,
  from: string,
  /** 읍면동 코스의 시군구 코드(`geo.prefix`). 저쪽 동 지도의 주소가 이 코드다. */
  dongPrefix?: string,
): string | null {
  const path = learnPath(courseId, dongPrefix);
  if (!path) return null;
  /*
   * 어디서 넘어왔는지를 싣는다. 안 넘어갈 때 문구 문제인지 자리 문제인지
   * 갈리지 않으면 고칠 수가 없다.
   */
  return `${ATLAS}${path}?utm_source=sigun-typing&utm_medium=${from}`;
}

function learnPath(courseId: string, dongPrefix?: string): string | null {
  /*
   * 읍면동은 저쪽도 시군구 코드로 연다(`/ko/learn/dong/32010/` = 춘천시).
   * 우리 코스의 `geo.prefix`가 같은 코드라 그대로 이어진다.
   *
   * 이 주소들은 HTTP 응답이 404다 — 저쪽이 GitHub Pages라 SPA 폴백으로
   * 돌려주기 때문이고, 브라우저에서는 제대로 뜬다. 사람이 눌러서 가는
   * 링크라 문제가 되지 않는다.
   */
  if (dongPrefix) return `/ko/learn/dong/${dongPrefix}/`;
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

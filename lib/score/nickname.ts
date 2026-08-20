/**
 * 이름 검사.
 *
 * 이 사이트에서 **남에게 보이는 사용자 입력은 이름 하나뿐이다.** 랭킹에 올라
 * 모두가 보고, 대결 방에서 최대 여덟 명이 본다. 그래서 여기가 뚫리면 사이트가
 * 망가져 보이는 유일한 자리다.
 *
 * ── 완벽을 노리지 않는다 ──────────────────────────────────
 * 한국어 욕설은 변형이 무한하다. `시발`을 막으면 `시1발`, `씨발`, `ㅅㅂ`,
 * `시 발`이 온다. 목록을 늘릴수록 정상 이름을 막는 오탐이 함께 늘고, 그건
 * 욕설이 하나 지나가는 것보다 나쁘다 — 욕설은 나중에 내릴 수 있지만 막힌
 * 사람은 그냥 떠난다.
 *
 * 그래서 **명백한 것만 막는다.** 사이 글자와 반복을 지운 뒤 목록과 대조하고,
 * 걸리면 거절한다. 나머지는 신고와 차단 목록이 할 일이다.
 *
 * 사칭은 다르다. 목록이 짧고 닫혀 있으며(운영자·관리자·admin), 오탐이 나도
 * 그 이름을 꼭 써야 할 사람이 없다. 여기는 넉넉히 막아도 손해가 없다.
 */

export const MAX_NICKNAME = 12;

export type NicknameRejection = "empty" | "too_long" | "impersonation" | "profanity" | "link";

export type NicknameResult =
  | { ok: true; name: string }
  | { ok: false; reason: NicknameRejection; message: string };

/**
 * 대조용으로 납작하게 만든 꼴.
 *
 * 검사에만 쓰고 저장하지 않는다. 저장은 사용자가 친 그대로 한다 — 이름은
 * 그 사람의 것이고, 우리가 고쳐 쓸 물건이 아니다.
 *
 * 하는 일 셋. 호환 문자를 정규 꼴로 모으고(전각 `ａ`와 `a`가 같아진다),
 * 한글·영문·숫자가 아닌 것을 다 버리고(`시.발`, `시 발`, `시_발`이 같아진다),
 * 같은 글자가 잇달아 나오면 하나로 줄인다(`시이발`은 안 걸리지만 `시발발`은
 * 걸린다).
 *
 * 남기는 글자에 **낱자모 블록(U+1100~U+11FF)을 반드시 넣는다.** NFKC가
 * `ㅅ`(U+3145)을 그 블록으로 옮기기 때문이다. 빠뜨렸더니 `ㅅㅂ` 같은 초성
 * 목록이 통째로 빈 문자열이 되었고, 빈 문자열은 모든 이름에 들어 있으므로
 * **모든 이름이 욕설로 걸렸다.**
 */
function flatten(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\u1100-\u11FFㄱ-ㅎㅏ-ㅣ]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * 대조 목록을 미리 납작하게 만들어 둔다.
 *
 * 빈 것은 버린다. 목록에 손대다 빈 문자열이 하나라도 섞이면 모든 이름이
 * 걸리는데, 그 사고를 한 번 냈다.
 */
function patterns(words: readonly string[]): string[] {
  return words.map(flatten).filter((w) => w.length > 0);
}

/**
 * 사칭.
 *
 * 이 이름들로 순위표에 오르면 그 기록이 공지처럼 읽힌다. 목록이 닫혀 있고
 * 오탐이 나도 아쉬울 사람이 없어서, 포함만 되면 막는다.
 */
const IMPERSONATION = [
  "관리자",
  "운영자",
  "운영진",
  "운영팀",
  "개발자",
  "매니저",
  "공지",
  "admin",
  "administrator",
  "moderator",
  "root",
  "system",
  "staff",
  "official",
  "시군타이핑",
];

/**
 * 욕설.
 *
 * 짧고 명백한 것만 둔다. 사이 글자를 지운 꼴에서 **부분 일치**로 보므로
 * `씨발놈아`도 걸린다. 초성만 쓴 것도 흔해서 함께 둔다.
 *
 * 늘리고 싶어질 때 기준 하나: **그 문자열이 들어간 멀쩡한 이름을 하나라도
 * 떠올릴 수 있으면 넣지 않는다.** 예를 들어 `병신`은 넣지만 `병`은 안 된다.
 */
const PROFANITY = [
  "시발",
  "씨발",
  "시팔",
  "씨팔",
  "쉬발",
  "씹",
  "좆",
  "존나",
  "졸라",
  "지랄",
  "병신",
  "새끼",
  "개새",
  "미친놈",
  "미친년",
  "썅",
  "닥쳐",
  "꺼져",
  "보지",
  "자지",
  "фuck",
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "nigger",
  "faggot",
  "ㅅㅂ",
  "ㅆㅂ",
  "ㅄ",
  "ㅂㅅ",
  "ㅈㄹ",
  "ㄲㅈ",
  "ㅆㅅㄲ",
];

const IMPERSONATION_FLAT = patterns(IMPERSONATION);
const PROFANITY_FLAT = patterns(PROFANITY);

/** 이름 자리에 붙는 광고. 주소가 보이면 그건 이름이 아니다. */
const LINK = /(https?:|www\.|\.com|\.net|\.kr|\.io|\.gg|텔레그램|텔레|카톡아이디)/i;

/**
 * 이름을 받아 저장해도 되는지 가른다.
 *
 * 통과하면 **사용자가 친 그대로** 돌려준다. 보이지 않는 문자와 잇단 공백만
 * 정리한다 — 앞의 것은 순위표를 어지럽히고(방향 뒤집기 문자로 옆 줄까지
 * 망가뜨릴 수 있다), 뒤의 것은 같은 이름을 여럿으로 보이게 한다.
 */
export function checkNickname(raw: unknown): NicknameResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "empty", message: `이름은 1~${MAX_NICKNAME}자로 입력하세요` };
  }

  const name = raw
    // 제어 문자와 줄 구분자. 보이지 않으면서 줄을 망가뜨린다.
    .replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "")
    // 폭 없는 공백들. 눈에 안 보이는데 글자 수를 채우고 이름을 갈라놓는다.
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (name.length === 0) {
    return { ok: false, reason: "empty", message: `이름은 1~${MAX_NICKNAME}자로 입력하세요` };
  }
  if (name.length > MAX_NICKNAME) {
    return { ok: false, reason: "too_long", message: `이름은 ${MAX_NICKNAME}자까지 됩니다` };
  }
  if (LINK.test(name)) {
    return { ok: false, reason: "link", message: "이름에 주소를 넣을 수 없습니다" };
  }

  const flat = flatten(name);
  if (IMPERSONATION_FLAT.some((word) => flat.includes(word))) {
    return { ok: false, reason: "impersonation", message: "쓸 수 없는 이름입니다" };
  }
  if (PROFANITY_FLAT.some((word) => flat.includes(word))) {
    /*
     * 무엇에 걸렸는지 말하지 않는다. 알려 주면 목록을 역으로 짚어 가며
     * 빠져나갈 꼴을 찾는 일이 쉬워진다.
     */
    return { ok: false, reason: "profanity", message: "쓸 수 없는 이름입니다" };
  }

  return { ok: true, name };
}

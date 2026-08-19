import type { ItemResult } from "./types";

/**
 * 지역 하나가 어떻게 끝났는가.
 *
 * 셋으로 끊는다. 더 나누면 읽는 쪽이 범례를 봐야 하는데, 이 값이 나가는 자리는
 * 채팅방에 붙는 그림과 링크 미리보기 카드다. 거기에 범례를 달 수는 없다.
 *
 * 노랑(`struggled`)은 "힌트"가 아니라 **"헤맸다"**다. 초성을 본 것과 한 번
 * 틀리고 고쳐 맞힌 것은 같은 일이다 — 둘 다 바로 안 떠올랐다는 뜻이다.
 */
export const MARK = { clean: 0, struggled: 1, missed: 2 } as const;
export type Mark = (typeof MARK)[keyof typeof MARK];

export function markOf(r: ItemResult | undefined): Mark {
  // 판을 도중에 접으면 뒤쪽 지역은 결과 자체가 없다. 못 맞힌 것으로 친다.
  if (!r || r.skipped) return MARK.missed;
  if (r.hinted || r.errors > 0 || r.attempts > 1) return MARK.struggled;
  return MARK.clean;
}

/*
 * 주소에 실어 보내기 위한 꾸러미.
 *
 * 카드 그림은 서버가 그리는데, 서버가 아는 것은 주소뿐이다. 여태 주소에는
 * 기록과 이름만 있어서 카드의 지도가 통째로 한 색이었다 — 이모지 격자는
 * 색이 갈리는데 카드는 안 갈리는, 같은 판의 두 그림이 서로 다른 말을 하는
 * 상태였다.
 *
 * 상태가 셋이라 한 곳에 2비트다. 전국 229곳이 458비트, 58바이트, 주소에서는
 * 78자다. 서울은 열 자.
 *
 * 순서는 **격자 자리표의 칸 순서**(왼쪽 위부터 행 우선, 빈 칸 제외)를 따른다.
 * 양쪽이 같은 자리표를 들고 있으므로 순서를 따로 실어 보낼 필요가 없다.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function encodeMarks(marks: readonly Mark[]): string {
  const bytes = new Uint8Array(Math.ceil((marks.length * 2) / 8));
  marks.forEach((m, i) => {
    // 앞에서부터 2비트씩. 한 바이트에 네 곳이 들어간다.
    bytes[i >> 2] |= (m & 0b11) << (6 - (i % 4) * 2);
  });
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const take = Math.min(4, Math.ceil((bytes.length - i) * 4 / 3));
    for (let k = 0; k < take; k++) out += ALPHABET[(n >> (18 - k * 6)) & 63];
  }
  return out;
}

/**
 * 못 읽으면 null. 남이 손댈 수 있는 값이라 길이가 안 맞거나 모르는 글자가
 * 섞이면 그냥 버린다 — 카드가 조금 심심해질 뿐이고, 그게 억지로 그리다
 * 어긋난 지도를 보여 주는 것보다 낫다.
 */
export function decodeMarks(code: string, count: number): Mark[] | null {
  if (!code) return null;
  const bytes = new Uint8Array(Math.ceil((count * 2) / 8));
  let acc = 0;
  let bits = 0;
  let at = 0;
  for (const ch of code) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    while (bits >= 8) {
      bits -= 8;
      if (at < bytes.length) bytes[at++] = (acc >> bits) & 0xff;
    }
  }
  if (at < bytes.length) return null;
  return Array.from({ length: count }, (_, i) => {
    const v = (bytes[i >> 2] >> (6 - (i % 4) * 2)) & 0b11;
    return (v > MARK.missed ? MARK.missed : v) as Mark;
  });
}

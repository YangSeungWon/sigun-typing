import type { Region } from "../types.ts";

/**
 * 코스의 장소 하나.
 *
 * **정답은 지도에 적히는 정식 명칭이다** — `종로구`, `이천시`, `가평군`.
 *
 * 한때는 접미사를 뗀 `종로`가 표준 표기였고 `종로구`를 별칭으로 받았다.
 * 치는 양은 줄지만 규칙이 이름마다 달라진다 — `종로`는 되는데 `중구`는
 * 떼면 남는 게 없어 그대로 쳐야 하고, `광주`는 광주시인지 광주광역시인지,
 * `고성`은 강원 고성군인지 경남 고성군인지 알 수 없다. 접미사를 떼는 순간
 * 이 게임이 가르치려는 것(정확한 행정구역 이름)도 함께 흐려진다.
 *
 * 이제 규칙은 한 문장이다 — **지도에 적힌 이름을 그대로 친다.**
 *
 * @param name    접미사를 뗀 이름. `중구`처럼 뗄 수 없는 이름은 통째로 준다.
 * @param suffix  붙이면 정식 명칭이 되는 접미사. 이름 자체가 정식이면 생략.
 * @param extra   추가로 인정할 표기. 정답을 흐리므로 이유가 있을 때만 —
 *                원본 경계가 옛 이름을 쓰는 경우(`미추홀구` ← `남구`)가 그렇다.
 */
export function place(
  code: string,
  name: string,
  suffix?: "구" | "군" | "시",
  extra: string[] = [],
): Region {
  const full = suffix ? name + suffix : name;
  return extra.length > 0 ? { code, name: full, aliases: extra } : { code, name: full };
}

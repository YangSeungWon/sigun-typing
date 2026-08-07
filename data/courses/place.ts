import type { Region } from "../types.ts";

/**
 * 코스의 장소 하나.
 *
 * 접미사를 뗀 이름이 지명으로 성립하는지는 이름마다 다르다 —
 * `종로구`는 `종로`, `기장군`은 `기장`이 되지만 `중구`에서 `구`를 떼면
 * 남는 게 없다. 자동 판별은 반드시 어딘가에서 틀리므로 부를 때 명시한다.
 *
 * @param name    게임에서 입력할 표준 표기
 * @param suffix  붙이면 정식 명칭이 되는 접미사. 이름 자체가 정식이면 생략.
 * @param extra   원본 경계가 옛 이름을 쓰는 경우 등, 추가로 인정할 표기.
 *                여기 정식 명칭이 하나는 있어야 지도와 이어진다.
 */
export function place(
  code: string,
  name: string,
  suffix?: "구" | "군" | "시",
  extra: string[] = [],
): Region {
  const aliases = [...(suffix ? [name + suffix] : []), ...extra];
  return aliases.length > 0 ? { code, name, aliases } : { code, name };
}

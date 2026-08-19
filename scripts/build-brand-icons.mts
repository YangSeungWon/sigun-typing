import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { siKakaotalk, siX } from "simple-icons";

/**
 * 공유 단추에 쓸 브랜드 마크를 뽑는다. 실행: `npm run build:brand`
 *
 * 손으로 그리지 않는다. 카카오톡과 X의 로고는 상표이고, 비슷하게 흉내 낸 도형은
 * 법적으로도 보기에도 좋지 않다. simple-icons가 각 브랜드의 공식 마크를 SVG
 * 경로로 정리해 두었으므로 그것을 그대로 가져온다.
 *
 * 런타임 의존으로 두지 않는 이유: 우리가 쓰는 것은 문자열 두 개인데 패키지는
 * 삼천 개가 넘는 아이콘을 담고 있다. 빌드 때 뽑아 두면 번들에 두 줄만 실린다.
 *
 * 상표권은 각 브랜드에 있다. 색을 바꾸거나 찌그러뜨리지 않는다 — 마크는 마크
 * 그대로 두고, 우리 톤은 그 주변(테두리·배경)에서 낸다.
 */
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "../components/share/brandPaths.ts");

const body = `// scripts/build-brand-icons.mts가 만든 파일이다. 손으로 고치지 않는다.
//
// 출처: simple-icons — 각 브랜드의 공식 마크를 SVG 경로로 정리한 모음.
// 상표권은 카카오와 X에 있다. viewBox는 둘 다 "0 0 24 24"다.

/** 브랜드 고유색. 마크를 색으로 쓸 때만 참고한다. */
export const BRAND_HEX = {
  kakaotalk: "#${siKakaotalk.hex}",
  x: "#${siX.hex}",
} as const;

export const BRAND_PATH = {
  kakaotalk:
    "${siKakaotalk.path}",
  x: "${siX.path}",
} as const;
`;

await writeFile(OUT, body);
console.log(`브랜드 마크 둘 → components/share/brandPaths.ts`);

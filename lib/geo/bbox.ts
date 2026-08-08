import type { RegionShape } from "@/data/geo/types";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * path 문자열이 차지하는 사각형.
 *
 * 빌드 때 함께 저장하지 않고 여기서 구하는 이유: 경계 파일을 다시 만들려면
 * 원본 SGIS 자료가 있어야 하는데 그건 저장소에 없다. path는 M/L/Z와 좌표만
 * 쓰는 단순한 형태라(곡선이 없다) 숫자만 훑으면 정확한 값이 나온다.
 */
export function pathBox(d: string): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // "M354.6,194.3L358.2,192.9…" — 숫자만 차례대로 뽑아 짝을 짓는다.
  const numbers = d.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers) return { x: 0, y: 0, width: 0, height: 0 };

  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = Number(numbers[i]);
    const y = Number(numbers[i + 1]);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 지역의 **본체**가 차지하는 사각형.
 *
 * 섬이 딸린 지역은 path 하나에 여러 덩어리가 들어 있고, 그중에는 본토에서
 * 한참 떨어진 것도 있다(안산의 대부도, 옹진의 섬들). 전체를 감싸는 사각형을
 * 쓰면 바다까지 포함해 실제 지역보다 몇 배 넓어지고, 그러면 "이 지역은 이미
 * 크다"고 판단해 확대를 안 하게 된다.
 *
 * 그래서 덩어리별로 사각형을 구해 가장 넓은 것을 본체로 본다.
 */
export function mainPathBox(d: string): Box {
  // path는 "M…L…Z" 덩어리가 이어 붙은 형태다.
  const parts = d.split("M").filter((part) => part.trim().length > 0);
  if (parts.length <= 1) return pathBox(d);

  let best = pathBox(`M${parts[0]}`);
  for (let i = 1; i < parts.length; i++) {
    const box = pathBox(`M${parts[i]}`);
    if (box.width * box.height > best.width * best.height) best = box;
  }
  return best;
}

/**
 * 지금 문제인 지역을 화면 가운데로 끌어오는 변환.
 *
 * viewBox를 직접 바꾸지 않고 안쪽 <g>에 transform을 거는 이유: viewBox는 CSS로
 * 부드럽게 이어지지 않지만 transform은 된다. 같은 결과를 얻으면서 애니메이션이
 * 공짜로 따라온다.
 *
 * 배율은 지역이 화면의 일정 비율을 차지하도록 잡되 상한을 둔다. 작은 구 하나를
 * 꽉 채우도록 당기면 주변이 다 잘려 나가 "여기가 어디인가"를 물을 수 없다 —
 * 이 게임에서 주변 모양은 문제의 일부다.
 */
export function focusTransform(
  region: RegionShape | undefined,
  view: { width: number; height: number },
  options: { fill?: number; maxScale?: number } = {},
): string {
  if (!region) return "";

  const fill = options.fill ?? 0.34;
  const maxScale = options.maxScale ?? 4;

  const box = mainPathBox(region.d);
  if (box.width <= 0 || box.height <= 0) return "";

  // 지역이 화면의 fill 비율만큼 차지하게 하는 배율. 가로세로 중 빡빡한 쪽에 맞춘다.
  const raw = Math.min(
    (view.width * fill) / box.width,
    (view.height * fill) / box.height,
  );
  const scale = Math.min(Math.max(raw, 1), maxScale);

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  /*
   * 가장자리 지역을 가운데로 끌어오면 지도 바깥의 빈 공간이 화면에 들어온다.
   * 중심을 지도 안쪽으로 밀어 넣어 그 여백을 없앤다.
   */
  const halfW = view.width / (2 * scale);
  const halfH = view.height / (2 * scale);
  const clampedX = Math.min(Math.max(cx, halfW), view.width - halfW);
  const clampedY = Math.min(Math.max(cy, halfH), view.height - halfH);

  return `translate(${view.width / 2} ${view.height / 2}) scale(${scale}) translate(${-clampedX} ${-clampedY})`;
}

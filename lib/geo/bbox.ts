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
 * 공짜로 따라온다. 반환값은 CSS transform 문법이다(아래 참고).
 *
 * 배율은 지역이 화면의 일정 비율을 차지하도록 잡되 상한을 둔다. 작은 구 하나를
 * 꽉 채우도록 당기면 주변이 다 잘려 나가 "여기가 어디인가"를 물을 수 없다 —
 * 이 게임에서 주변 모양은 문제의 일부다.
 */
/**
 * 지금 지역을 보려면 몇 배로 당겨야 하는가.
 *
 * 미니맵을 띄울지 정하는 데 쓴다. 조금만 당긴 상태에서는 화면에 이미 전체가
 * 거의 다 들어와 있어서, 미니맵이 같은 그림을 작게 한 번 더 그리는 꼴이 된다.
 */
export function focusScale(
  region: RegionShape | undefined,
  view: { width: number; height: number },
  options: { fill?: number; maxScale?: number } = {},
): number {
  if (!region) return 1;
  const box = mainPathBox(region.d);
  if (box.width <= 0 || box.height <= 0) return 1;
  const raw = Math.min(
    (view.width * (options.fill ?? 0.42)) / box.width,
    (view.height * (options.fill ?? 0.42)) / box.height,
  );
  return Math.min(Math.max(raw, 1), options.maxScale ?? 4);
}

export function focusTransform(
  region: RegionShape | undefined,
  view: { width: number; height: number },
  options: { fill?: number; maxScale?: number; minSpan?: number } = {},
): string {
  if (!region) return "";

  /*
   * 지역이 화면에서 차지할 비율.
   *
   * 0.34 → 0.42까지 올렸다가 0.36으로 되돌렸다. 타깃이 너무 작으면 "어디를
   * 봐야 하지"부터 찾게 되지만, 너무 크면 반대쪽 문제가 생긴다 — 화면에
   * 그 지역만 남아 **어디에 붙어 있는지가 안 보인다.** 이 게임에서 맞히는
   * 실마리는 모양 자체보다 인접 관계인 경우가 많다. 이웃이 잘리면 확대가
   * 오히려 문제를 어렵게 만든다.
   */
  const fill = options.fill ?? 0.36;
  /*
   * 배율 상한도 낮췄다(4 → 3). 서울 중구처럼 작은 지역에서 상한까지 당기면
   * 지도가 아니라 도형 하나가 화면을 채운다.
   */
  const maxScale = options.maxScale ?? 3;

  const box = mainPathBox(region.d);
  if (box.width <= 0 || box.height <= 0) return "";

  // 지역이 화면의 fill 비율만큼 차지하게 하는 배율. 가로세로 중 빡빡한 쪽에 맞춘다.
  const raw = Math.min(
    (view.width * fill) / box.width,
    (view.height * fill) / box.height,
  );

  /*
   * 기본 상한 아래에 **바닥**을 깐다.
   *
   * 상한 3은 한 지역이 지도에서 제법 큰 자리를 차지할 때를 전제로 잡은 값이다.
   * 전국 시군구 지도에서는 대구 중구가 3px이라, 3배로 당겨도 10px짜리 점으로
   * 남는다 — 어디가 문제인지 보이지 않는다.
   *
   * 그래서 "지도의 이만큼보다는 커야 한다"는 선을 하나 두고, 상한과 그 선 중
   * 큰 쪽을 쓴다. 기존 코스는 이 선에 닿지 않으므로(코스 열여덟 중 인천의
   * 한 지역만 3.0 → 3.3) 지금까지의 화면이 그대로 유지된다.
   *
   * 상한을 **직접 준 호출부**에는 적용하지 않는다. 그건 "여기까지만"이라고
   * 말한 것이지 "적당히 알아서"가 아니다.
   */
  const cap =
    options.maxScale !== undefined
      ? options.maxScale
      : Math.max(
          maxScale,
          ((options.minSpan ?? 0.09) * Math.min(view.width, view.height)) /
            Math.min(box.width, box.height),
        );
  const scale = Math.min(Math.max(raw, 1), cap);

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

  /*
   * SVG의 transform **속성**이 아니라 CSS transform 문법으로 낸다
   * (`translate(500px, 400px)`, 공백이 아니라 쉼표와 단위).
   *
   * 속성으로 걸면 브라우저에 따라 트랜지션이 붙지 않아 지도가 뚝 끊긴 채로
   * 다음 지역으로 튄다. CSS 속성으로 걸면 어디서나 이어진다. 쓰는 쪽에서
   * `transform-box: view-box; transform-origin: 0 0`을 함께 줘야 속성과
   * 같은 좌표계가 된다 — 그러면 1px이 곧 viewBox 한 칸이다.
   */
  return `translate(${view.width / 2}px, ${view.height / 2}px) scale(${scale}) translate(${-clampedX}px, ${-clampedY}px)`;
}

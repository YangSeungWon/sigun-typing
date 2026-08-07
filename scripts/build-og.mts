import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import sido from "../data/geo/sido.json" with { type: "json" };

/**
 * 공유 카드 이미지를 만든다. `npm run build:og` → public/og.png
 *
 * 링크를 붙였을 때 미리보기가 없으면, 그 링크는 주소 문자열 하나로 지나간다.
 * 유통이 제일 약한 고리인 상황에서 이건 가장 싼 보강이다.
 *
 * ── 왜 빌드 때 한 장 뜨는가 ──────────────────────────────────
 * 런타임 생성(next/og)은 satori가 woff2를 못 읽어서 한글 폰트를 따로
 * 넣어야 한다. 반면 여기서는 진짜 브라우저가 진짜 폰트와 진짜 지도로
 * 그리므로, 화면에 보이는 것과 카드가 같은 물건이 된다.
 * Playwright는 개발 의존성이고 결과물만 저장소에 들어가므로,
 * 운영 이미지에는 아무 부담도 남지 않는다.
 *
 * 지도나 색을 바꾸면 이 스크립트를 다시 돌려야 한다. 코스 목록은 일부러
 * 읽지 않는다 — data/courses는 확장자 없는 상대 경로를 쓰고 있어 Node에서
 * 그대로 실행되지 않고, 이 카드에 필요한 건 지도 한 장뿐이다.
 */

const WIDTH = 1200;
const HEIGHT = 630;
const OUT = new URL("../public/og.png", import.meta.url);

/** 실제 게임 화면과 같은 색이어야 한다. 카드만 다른 색이면 딴 서비스로 보인다. */
const COLOR = {
  concrete: "#dee0db",
  concreteDeep: "#c7cac3",
  mapIdle: "#bfc3bb",
  mapLine: "#e8eae5",
  sign: "#0a6b3d",
  signDeep: "#06522e",
  centerline: "#f0c420",
  paint: "#f7f9f5",
  ink: "#101410",
};

/**
 * 지도에 무엇을 칠할 것인가.
 *
 * 다 칠하면 완성된 그림이라 할 일이 없어 보이고, 다 비우면 무슨 게임인지
 * 알 수 없다. **일부는 칠해져 있고 한 곳은 노랗게 남은** 상태 —
 * 즉 플레이 중간 화면이 이 게임을 가장 정확히 보여 준다.
 */
const CURRENT = "43"; // 충북. 가운데에 있어 카드 중앙에서 눈에 띈다.
const PASSED = new Set(["11", "28", "41", "42", "51", "36", "30", "44"]);

const fontBase64 = readFileSync(
  new URL("../public/fonts/PretendardVariable.woff2", import.meta.url),
).toString("base64");

const paths = sido.regions
  .map((r) => {
    const fill =
      r.code === CURRENT
        ? COLOR.centerline
        : PASSED.has(r.code)
          ? COLOR.sign
          : COLOR.mapIdle;
    return `<path d="${r.d}" fill="${fill}" stroke="${COLOR.mapLine}" stroke-width="2" stroke-linejoin="round"/>`;
  })
  .join("");

const currentPath = sido.regions.find((r) => r.code === CURRENT)!;

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Pretendard";
    src: url(data:font/woff2;base64,${fontBase64}) format("woff2");
    font-weight: 45 920;
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    display: flex; align-items: center; gap: 32px;
    padding: 0 68px;
    background: ${COLOR.concrete};
    color: ${COLOR.ink};
    font-family: "Pretendard", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .text { display: flex; flex-direction: column; gap: 22px; flex: 1; }
  h1 { font-size: 68px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  p { font-size: 29px; line-height: 1.45; color: #3b423b; word-break: keep-all; }
  /* 실제 게임의 표지판. 여기서는 정답을 절반만 보여 준다 — 맞히는 중이라는 뜻이다. */
  .plate {
    align-self: flex-start;
    display: flex; align-items: flex-end; gap: 10px;
    background: ${COLOR.sign};
    border: 3px solid ${COLOR.paint};
    border-radius: 12px;
    box-shadow: 0 5px 0 0 ${COLOR.signDeep};
    padding: 18px 40px;
    color: ${COLOR.paint};
    font-size: 56px; font-weight: 700;
  }
  .caret {
    width: 4px; height: 52px; background: ${COLOR.centerline};
    margin-left: 4px;
  }
  .map { position: relative; width: 500px; height: 100%; display: flex; align-items: center; }
  .foot {
    position: absolute; left: 72px; bottom: 40px;
    font-size: 21px; color: #6b716a; letter-spacing: 0.02em;
  }
</style>
<div class="text">
  <h1>시군 타이핑</h1>
  <p>지도에 표시된 지역이 어디인지 떠올려<br>이름을 직접 입력하세요</p>
  <div class="plate">충<span class="caret"></span></div>
</div>
<div class="map">
  <svg viewBox="0 0 ${sido.width} ${sido.height}" width="500">
    ${paths}
    <!-- 지금 문제인 곳은 한 번 더 감싼다. 작은 지역이 묻히지 않게. -->
    <path d="${currentPath.d}" fill="none" stroke="${COLOR.ink}" stroke-width="5" stroke-linejoin="round"/>
  </svg>
</div>
<div class="foot">전국 ${sido.regions.length} 시도부터 · 시군 · 구까지</div>
`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  // 카드는 고해상도 화면에서도 선명해야 한다.
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: "png" });
await browser.close();

writeFileSync(OUT, png);
process.stdout.write(
  `공유 카드 ${OUT.pathname} (${WIDTH}×${HEIGHT}@2x, ${Math.round(png.length / 1024)}KB)\n`,
);

import { describe, expect, it } from "vitest";
import { createDeviceChurn, isCrawler } from "./bots";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const SAMSUNG =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";

describe("스스로 밝히는 봇", () => {
  it("사람이 쓰는 브라우저는 통과시킨다", () => {
    for (const ua of [CHROME, IPHONE, SAMSUNG]) {
      expect(isCrawler(ua), ua.slice(0, 30)).toBe(false);
    }
  });

  it("검색엔진과 미리보기 봇을 잡는다", () => {
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)",
      "Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html)",
      "Mozilla/5.0 (compatible; Baiduspider/2.0)",
      "facebookexternalhit/1.1",
      "Slackbot-LinkExpanding 1.0",
    ];
    for (const ua of bots) expect(isCrawler(ua), ua.slice(0, 30)).toBe(true);
  });

  it("자동화 도구와 명령줄 도구를 잡는다", () => {
    for (const ua of ["HeadlessChrome/131.0.0.0", "python-requests/2.31.0", "curl/8.4.0"]) {
      expect(isCrawler(ua), ua).toBe(true);
    }
  });

  it("User-Agent가 없으면 사람으로 보지 않는다", () => {
    expect(isCrawler(null)).toBe(true);
    expect(isCrawler("")).toBe(true);
  });
});

describe("기기 갈아 끼우기", () => {
  const T0 = 1_000_000;

  it("한 사람이 계속 와도 걸리지 않는다", () => {
    const churn = createDeviceChurn(3, 60_000);
    for (let i = 0; i < 50; i++) {
      expect(churn.churning("1.2.3.4", "같은기기", T0 + i)).toBe(false);
    }
  });

  it("한 주소에서 새 기기가 쏟아지면 걸린다", () => {
    const churn = createDeviceChurn(3, 60_000);
    expect(churn.churning("1.2.3.4", "a", T0)).toBe(false);
    expect(churn.churning("1.2.3.4", "b", T0)).toBe(false);
    expect(churn.churning("1.2.3.4", "c", T0)).toBe(false);
    expect(churn.churning("1.2.3.4", "d", T0)).toBe(true);
  });

  it("주소가 다르면 서로 영향을 주지 않는다", () => {
    const churn = createDeviceChurn(2, 60_000);
    churn.churning("1.1.1.1", "a", T0);
    churn.churning("1.1.1.1", "b", T0);
    expect(churn.churning("1.1.1.1", "c", T0)).toBe(true);
    expect(churn.churning("2.2.2.2", "c", T0)).toBe(false);
  });

  it("창이 지나면 다시 센다", () => {
    const churn = createDeviceChurn(1, 60_000);
    churn.churning("1.2.3.4", "a", T0);
    expect(churn.churning("1.2.3.4", "b", T0)).toBe(true);
    expect(churn.churning("1.2.3.4", "c", T0 + 60_001)).toBe(false);
  });
});

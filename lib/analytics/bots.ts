/**
 * 사람이 아닌 트래픽 가려내기.
 *
 * 계측 테이블은 이 서비스의 유일한 눈이다. 거기 봇이 섞이면 숫자가 틀리는
 * 정도가 아니라 **거꾸로** 읽힌다 — 2026년 8월 10일 하루에 코스 페이지 조회가
 * 299명으로 뛰고 그중 3명만 게임을 시작했는데, 그걸 보고 "코스 페이지에서
 * 다 빠져나간다"고 읽을 뻔했다. 파 보니 분당 정확히 10건씩 일곱 시간을 도는
 * 자동화였다.
 *
 * 두 겹으로 본다. 이름을 밝히는 봇은 User-Agent로 거르고(대부분의 검색엔진이
 * 여기 걸린다), 이름을 숨기는 봇은 **기기 식별자를 갈아 끼우는 버릇**으로
 * 잡는다. 8월 10일의 그것은 뒤쪽이었다.
 */

/**
 * 스스로 봇이라 밝히는 User-Agent 조각.
 *
 * 소문자로 낮춰서 부분 일치로 본다. 진짜 브라우저의 UA에는 이 낱말들이 들어
 * 있지 않다 — `bot`이 들어간 브라우저는 없다. 그래서 헛걸림이 거의 없다.
 */
const CRAWLER_TOKENS = [
  "bot", // googlebot, bingbot, yandexbot, ahrefsbot, semrushbot, applebot …
  "crawl", // crawler, crawling
  "spider", // baiduspider
  "slurp", // yahoo
  "yeti", // 네이버
  "daum", // 다음
  "facebookexternalhit",
  "embedly",
  "quora link preview",
  "pinterest",
  "vkshare",
  "outbrain",
  "w3c_validator",
  "headlesschrome",
  "phantomjs",
  "puppeteer",
  "playwright",
  "python-requests",
  "curl/",
  "wget/",
  "go-http-client",
  "okhttp",
  "java/",
  "libwww-perl",
  "lighthouse",
] as const;

/** 스스로 봇이라 밝히는가. UA가 없는 것도 사람은 아니다. */
export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  return CRAWLER_TOKENS.some((token) => ua.includes(token));
}

/**
 * 한 주소가 짧은 시간에 서로 다른 기기를 몇 개나 쓰는가.
 *
 * 사람은 기기를 갈아 끼우지 않는다. 식별자는 브라우저 저장소에 남으므로
 * 다시 온 사람은 같은 값을 들고 온다. 한 주소에서 새 식별자가 쏟아지면
 * 그건 여러 사람이 아니라 한 자동화가 매번 새 창을 여는 것이다.
 *
 * 한도를 넉넉히 잡는다. 통신사와 학교·회사는 여럿을 한 주소 뒤에 묶으므로
 * 진짜 사람들도 한 주소를 나눠 쓴다. 막는 것이 아니라 **표시만** 하므로
 * 잘못 걸려도 게임은 그대로 돌아가고, 잃는 것은 그 사람들의 통계뿐이다.
 */
export interface DeviceChurn {
  /** 이 주소가 이 창에서 본 서로 다른 기기 수. 한도를 넘었으면 true. */
  churning(address: string, deviceId: string, now: number): boolean;
}

/** 주소를 몇 개까지 들고 있을 것인가. 없으면 이 장치 자체가 메모리 공격이 된다. */
const MAX_ADDRESSES = 5_000;
/** 한 주소가 들고 있을 기기 식별자 수. 넘으면 어차피 봇이라 더 셀 필요가 없다. */
const MAX_DEVICES = 200;

export function createDeviceChurn(limit: number, windowMs: number): DeviceChurn {
  const windows = new Map<string, { devices: Set<string>; resetAt: number }>();

  return {
    churning(address: string, deviceId: string, now: number): boolean {
      const current = windows.get(address);
      if (!current || current.resetAt <= now) {
        for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
        while (windows.size >= MAX_ADDRESSES) {
          const oldest = windows.keys().next().value;
          if (oldest === undefined) break;
          windows.delete(oldest);
        }
        windows.set(address, { devices: new Set([deviceId]), resetAt: now + windowMs });
        return false;
      }
      if (current.devices.size < MAX_DEVICES) current.devices.add(deviceId);
      return current.devices.size > limit;
    },
  };
}

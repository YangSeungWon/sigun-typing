/**
 * 요청 빈도 제한.
 *
 * 프로세스 메모리에만 산다. 웹은 컨테이너 하나로 뜨므로 이걸로 충분하고,
 * 재시작하면 창이 비워진다 — 남용을 완전히 막는 장치가 아니라 **비용을
 * 올리는 장치**다. 무한정 부을 수 있던 것을 분당 몇 번으로 낮추는 것이
 * 목적이고, 그 이상이 필요해지면 그때는 프록시 단에서 막을 일이다.
 *
 * 창은 고정 구간(fixed window)이다. 경계에서 두 배까지 통과할 수 있지만,
 * 여기서 막으려는 건 정밀한 형평이 아니라 자동화된 붓기다.
 */

interface Window {
  count: number;
  /** 이 창이 끝나는 시각 */
  resetAt: number;
}

export interface RateLimiter {
  /** 한 번 세고, 아직 여유가 있으면 true. */
  take(key: string, now: number): boolean;
}

/**
 * 키를 몇 개까지 들고 있을 것인가.
 *
 * 이 한도가 없으면 남이 키를 무한히 만들어 보내는 것만으로 메모리를 채울 수
 * 있다 — 빈도 제한 자체가 공격 수단이 되는 것이다. 한도에 닿으면 만료된
 * 것부터 버리고, 그래도 모자라면 가장 오래된 것부터 버린다.
 */
const MAX_KEYS = 10_000;

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const windows = new Map<string, Window>();

  function evict(now: number) {
    for (const [key, w] of windows) {
      if (w.resetAt <= now) windows.delete(key);
    }
    // 전부 살아 있는 창이라면 오래된 순으로 버린다. Map은 삽입 순서를 지킨다.
    while (windows.size >= MAX_KEYS) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) break;
      windows.delete(oldest);
    }
  }

  return {
    take(key: string, now: number): boolean {
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        if (windows.size >= MAX_KEYS) evict(now);
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      current.count += 1;
      return current.count <= limit;
    },
  };
}

/**
 * 요청을 보낸 쪽을 가리키는 값.
 *
 * 리버스 프록시 뒤에 있으므로 소켓 주소는 항상 프록시다. 그래서
 * X-Forwarded-For의 **첫** 항목을 쓴다 — 프록시가 덧붙이는 값이라 그 앞의
 * 것은 클라이언트가 지어낸 것일 수 있다. 여기서 완벽한 신원을 얻으려는 게
 * 아니라, 같은 곳에서 쏟아지는 요청을 한 덩어리로 묶으려는 것이다.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

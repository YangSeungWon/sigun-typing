import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rateLimit";

describe("요청 빈도 제한", () => {
  it("한도까지는 통과시키고 그 뒤로 막는다", () => {
    const limiter = createRateLimiter(3, 60_000);
    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("a", 10)).toBe(true);
    expect(limiter.take("a", 20)).toBe(true);
    expect(limiter.take("a", 30)).toBe(false);
  });

  it("키가 다르면 서로 영향을 주지 않는다", () => {
    const limiter = createRateLimiter(1, 60_000);
    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("b", 0)).toBe(true);
    expect(limiter.take("a", 0)).toBe(false);
  });

  it("창이 지나면 다시 열린다", () => {
    const limiter = createRateLimiter(1, 1_000);
    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("a", 500)).toBe(false);
    expect(limiter.take("a", 1_001)).toBe(true);
  });

  it("키를 무한히 만들어도 메모리가 늘지 않는다", () => {
    // 빈도 제한 자체가 공격 수단이 되면 안 된다.
    const limiter = createRateLimiter(1, 60_000);
    for (let i = 0; i < 30_000; i++) limiter.take(`key-${i}`, 0);
    // 오래된 키가 밀려났으므로 처음 키는 다시 통과한다 — 그게 밀려났다는 증거다.
    expect(limiter.take("key-0", 0)).toBe(true);
  });
});

describe("요청자 식별", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers });

  it("프록시가 붙인 첫 주소를 쓴다", () => {
    // 뒤쪽 항목은 클라이언트가 지어낼 수 있다.
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("헤더가 없으면 한 덩어리로 본다", () => {
    expect(clientKey(req({}))).toBe("unknown");
  });
});

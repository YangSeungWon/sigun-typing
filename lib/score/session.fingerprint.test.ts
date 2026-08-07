import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 지문은 비밀키가 다르면 반드시 달라야 한다. 이 성질이 깨지면 두 서비스가
 * 서로 다른 키를 쓰고 있어도 로그가 같아 보인다 — 알아채라고 만든 장치가
 * 못 알아채게 만드는 장치가 된다.
 */
async function fingerprintWith(secret: string): Promise<string> {
  vi.stubEnv("SCORE_SECRET", secret);
  vi.resetModules();
  const { secretFingerprint } = await import("./session");
  return secretFingerprint();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("서명 키 지문", () => {
  it("같은 키면 같은 지문이다", async () => {
    expect(await fingerprintWith("hello")).toBe(await fingerprintWith("hello"));
  });

  it("키가 다르면 지문도 다르다", async () => {
    expect(await fingerprintWith("hello")).not.toBe(await fingerprintWith("hellp"));
  });

  it("비밀키 자체는 드러나지 않는다", async () => {
    const secret = "super-secret-value";
    const printed = await fingerprintWith(secret);
    expect(printed).not.toContain(secret);
    expect(printed).toHaveLength(8);
  });
});

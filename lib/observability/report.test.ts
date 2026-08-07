import { describe, expect, it } from "vitest";
import { cleanPath, toErrorRow } from "./report";

describe("오류 기록", () => {
  it("주소에서 질의 문자열을 뗀다", () => {
    // 도전장 링크에는 닉네임과 기록이 실려 있다. 오류 기록에 남길 이유가 없다.
    expect(cleanPath("/play/quiz/sido?beat=19220&by=승원")).toBe("/play/quiz/sido");
    expect(cleanPath("/notes#top")).toBe("/notes");
    expect(cleanPath(undefined)).toBeUndefined();
  });

  it("Error에서 메시지와 스택을 꺼낸다", () => {
    const row = toErrorRow({ source: "server", error: new Error("터졌다") });
    expect(row.message).toBe("터졌다");
    expect(row.stack).toContain("터졌다");
    expect(row.source).toBe("server");
  });

  it("digest를 살려 둔다", () => {
    // React가 가려 놓은 오류를 로그와 맞춰 보는 유일한 열쇠다.
    const error = Object.assign(new Error("가려짐"), { digest: "3141592" });
    expect(toErrorRow({ source: "server", error }).digest).toBe("3141592");
  });

  it("Error가 아닌 것도 받아 낸다", () => {
    // throw "문자열" 같은 코드가 어딘가에는 있다.
    expect(toErrorRow({ source: "client", error: "문자열" }).message).toBe("문자열");
    expect(toErrorRow({ source: "client", error: null }).message).toBe("알 수 없는 오류");
  });

  it("지나치게 긴 값은 자른다", () => {
    const row = toErrorRow({
      source: "client",
      message: "가".repeat(2_000),
      stack: "나".repeat(10_000),
    });
    expect(row.message!.length).toBeLessThanOrEqual(501);
    expect(row.stack!.length).toBeLessThanOrEqual(4_001);
  });
});

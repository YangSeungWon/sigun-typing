import { describe, expect, it } from "vitest";
import { checkNickname } from "./nickname";

const pass = (raw: string) => checkNickname(raw);
const name = (raw: string) => {
  const r = checkNickname(raw);
  return r.ok ? r.name : null;
};

describe("이름 검사", () => {
  it("멀쩡한 이름은 친 그대로 통과한다", () => {
    // 저장은 사용자가 친 그대로 한다. 이름은 그 사람의 것이다.
    expect(name("승원")).toBe("승원");
    expect(name("Kim Ji-hoon")).toBe("Kim Ji-hoon");
    expect(name("포항시민")).toBe("포항시민");
    expect(name("ㅋㅋㅋ")).toBe("ㅋㅋㅋ");
  });

  it("잇단 공백은 하나로 줄인다", () => {
    // 안 줄이면 같은 이름이 순위표에서 여럿으로 보인다.
    expect(name("김  지  훈")).toBe("김 지 훈");
    expect(name("  승원  ")).toBe("승원");
  });

  it("보이지 않는 문자는 걷는다", () => {
    /*
     * 폭 없는 공백은 눈에 안 보이면서 글자 수를 채우고, 방향 뒤집기 문자는
     * 순위표의 옆 줄까지 거꾸로 만든다.
     */
    expect(name("승​원")).toBe("승원");
    expect(name("‮승원")).toBe("승원");
    expect(pass("​​").ok).toBe(false);
  });

  it("사칭은 막는다", () => {
    for (const raw of ["관리자", "운영자", "시군타이핑 운영팀", "ADMIN", "ａｄｍｉｎ", "관 리 자"]) {
      expect(pass(raw).ok, raw).toBe(false);
    }
    expect(checkNickname("관리자")).toMatchObject({ reason: "impersonation" });
  });

  it("욕설은 사이 글자를 넣어도 막는다", () => {
    // 대조는 한글·영문·숫자만 남기고 잇단 반복을 줄인 꼴로 한다.
    for (const raw of ["시발", "씨 발", "시.발", "병신1호", "ㅅㅂ", "존나빠름", "fuck you"]) {
      expect(pass(raw).ok, raw).toBe(false);
    }
  });

  it("무엇에 걸렸는지는 말하지 않는다", () => {
    // 알려 주면 목록을 역으로 짚어 빠져나갈 꼴을 찾기 쉬워진다.
    const r = checkNickname("시발");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("쓸 수 없는 이름입니다");
  });

  it("주소는 이름이 아니다", () => {
    for (const raw of ["abc.com", "www.x.kr", "텔레그램문의"]) {
      expect(pass(raw).ok, raw).toBe(false);
    }
  });

  it("길이를 넘으면 막는다", () => {
    expect(pass("가".repeat(12)).ok).toBe(true);
    expect(pass("가".repeat(13)).ok).toBe(false);
  });

  it("멀쩡한 이름을 욕설로 잘못 잡지 않는다", () => {
    /*
     * 오탐은 욕설 하나가 지나가는 것보다 나쁘다. 욕설은 나중에 내릴 수 있지만
     * 막힌 사람은 그냥 떠난다. 목록을 늘릴 때마다 여기에 한 줄씩 늘린다.
     */
    for (const raw of ["김병만", "지랑", "새벽", "보성군민", "미친듯이빠름", "부산갈매기"]) {
      expect(pass(raw).ok, raw).toBe(true);
    }
  });
});

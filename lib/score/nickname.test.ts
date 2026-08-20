import { describe, expect, it } from "vitest";
import { COURSES } from "@/data/courses";
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
    // 한 낱말 안에서는 점도 숫자도 밑줄도 지운 꼴로 대조한다.
    for (const raw of ["시발", "시.발", "시1발", "씨발놈아", "병신1호", "ㅅㅂ", "fuck you"]) {
      expect(pass(raw).ok, raw).toBe(false);
    }
  });

  it("낱말을 넘어가며 만들어진 꼴은 막지 않는다", () => {
    /*
     * 이름 전체에서 공백을 지우고 대조했더니 **우리 코스 이름 하나가 걸렸다** —
     * `수원시 팔달구`에서 공백을 지우면 `시팔`이 만들어진다. 영어에도 같은
     * 일이 있다(`Scunthorpe`).
     *
     * 그 대가로 공백으로 가른 회피(`시 발`)는 놓친다. 멀쩡한 지명을 막는
     * 쪽이 더 나쁘다.
     */
    expect(pass("수원시 팔달구 10개").ok).toBe(true);
    expect(pass("Scunthorpe").ok).toBe(true);
    expect(pass("시 발").ok).toBe(true);
  });

  it("저장소의 지명은 하나도 막히지 않는다", () => {
    /*
     * 오탐을 말로 따지지 않고 잰다. 목록을 늘린 뒤 이 검사가 깨지면 그
     * 항목은 낱말 전체 일치(PROFANITY_EXACT) 쪽으로 옮길 것.
     */
    const names = new Set<string>();
    for (const course of COURSES) {
      names.add(course.name.slice(0, 12));
      for (const region of course.regions) names.add(region.name);
    }
    expect(names.size).toBeGreaterThan(3000);
    const blocked = [...names].filter((n) => {
      const r = checkNickname(n);
      return !r.ok && r.reason !== "too_long";
    });
    expect(blocked).toEqual([]);
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
    for (const raw of [
      "김병만",
      "보성군민",
      "부산갈매기",
      // 아래는 전부 실제로 걸렸던 것들이다.
      "자지말고달려",
      "뒤돌아보지마",
      "새끼손가락",
      "졸라맨",
      "꺼져가는불",
      "shitake",
      "Bitchute",
      // 초성 두 자는 사람 이름의 초성이기도 하다.
      "ㅅㅂㅈ",
      "ㅂㅅㅎ",
    ]) {
      expect(pass(raw).ok, raw).toBe(true);
    }
  });
});

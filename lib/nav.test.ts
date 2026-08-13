import { describe, expect, it } from "vitest";
import { isActivePath, TAB_ITEMS } from "./nav";

describe("지금 어느 탭인가", () => {
  it("홈은 정확히 일치할 때만이다", () => {
    // 앞뒤로 걸치면 모든 주소가 홈을 켜서 탭 두 개가 동시에 켜진다.
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/courses", "/")).toBe(false);
  });

  it("하위 경로는 자기 탭에 속한다", () => {
    expect(isActivePath("/courses/seoul", "/courses")).toBe(true);
    expect(isActivePath("/notes", "/notes")).toBe(true);
  });

  it("앞글자만 같은 남의 경로를 켜지 않는다", () => {
    expect(isActivePath("/coursesomething", "/courses")).toBe(false);
  });

  it("어느 주소에서도 탭이 둘 이상 켜지지 않는다", () => {
    for (const path of ["/", "/courses", "/courses/seoul", "/rooms", "/notes", "/ranking"]) {
      const lit = TAB_ITEMS.filter((t) => isActivePath(path, t.href));
      expect(lit.length, `${path}에서 켜진 탭`).toBeLessThanOrEqual(1);
    }
  });

  it("탭은 넷이다", () => {
    // 다섯 번째가 생기면 그건 탭이 아니라 메뉴다.
    expect(TAB_ITEMS).toHaveLength(4);
  });
});

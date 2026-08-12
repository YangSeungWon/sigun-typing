import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignPlate } from "./SignPlate";

/** 원고지 칸 수. 가린 모드에서 이 수가 곧 "정답이 몇 글자인가"다. */
const cells = (html: string) => (html.match(/data-slot=""/g) ?? []).length;

const plate = (props: Partial<Parameters<typeof SignPlate>[0]> = {}) =>
  renderToStaticMarkup(
    <SignPlate target="수원" typed="" focused {...props} />,
  );

/**
 * 가린 모드에서 목표 글자가 새면 게임이 성립하지 않는다.
 * 예전에는 글자가 pending이 되는 순간 목표를 그려서, 초성 하나만 맞혀도
 * 답이 통째로 드러났다.
 */
describe("가린 모드에서 답이 새지 않는다", () => {
  it("아무것도 안 쳤으면 글자 수도 알려주지 않는다", () => {
    // 글자 수는 회상 퀴즈에서 큰 단서다. 초성 힌트가 5초를 무는데
    // 길이만 공짜로 주면 앞뒤가 안 맞는다.
    const html = plate({ masked: true });
    expect(html).toContain("지역명을 입력하세요");
    expect(html).not.toContain("○");
    expect(html).not.toContain("수");
    expect(html).not.toContain("원");
  });

  it("치기 시작해도 글자 수는 여전히 숨긴다", () => {
    // 첫 타건이 힌트 요청처럼 작동하면 안 된다. 길이는 힌트를 연 사람만 본다.
    const html = plate({ masked: true, typed: "ㅅ" });
    expect(cells(html), "친 만큼만 칸이 있어야 한다").toBe(1);
    expect(html).not.toContain("지역명을 입력하세요");
  });

  it("힌트를 열어야 글자 수가 드러난다", () => {
    const html = plate({ masked: true, typed: "ㅅ", hinted: true });
    expect(cells(html)).toBe(2);
  });

  it("초성만 쳐도 목표 글자가 드러나지 않는다", () => {
    const html = plate({ masked: true, typed: "ㅅ" });
    expect(html, "초성을 쳤다고 답이 보이면 안 된다").not.toContain("수");
    expect(html).toContain("ㅅ");
  });

  it("조합이 진행돼도 친 글자만 보인다", () => {
    const html = plate({ masked: true, typed: "수" });
    expect(html).toContain("수");
    expect(html, "다음 글자는 여전히 가려져야 한다").not.toContain("원");
  });

  it("이름이 적혀 있는 모드에는 원고지 칸을 그리지 않는다", () => {
    // 거기는 표지판이지 원고지가 아니다.
    expect(cells(plate({ typed: "수" }))).toBe(0);
  });

  it("다 맞히면 그때 전부 보인다", () => {
    const html = plate({ masked: true, typed: "수원" });
    expect(html).toContain("수");
    expect(html).toContain("원");
  });

  it("힌트를 열면 안 친 자리에 초성이 보인다", () => {
    const html = plate({ masked: true, hinted: true });
    expect(html).toContain("ㅅ");
    expect(html).toContain("ㅇ");
    expect(html).not.toContain("수");
  });

  it("스크린리더에도 답이 새지 않는다", () => {
    const html = plate({ masked: true, typed: "ㅅ" });
    expect(html).toContain('aria-label="지역명"');
    expect(html).not.toContain("수원");
  });
});

describe("무엇을 쳤는지 보인다", () => {
  it("조합 중인 칸에는 목표가 아니라 지금 조합 중인 글자가 보인다", () => {
    // 판면이 내내 `곡`이면 손이 ㄱ에 있는지 고에 있는지 알 수 없다.
    const html = plate({ target: "곡성", typed: "고" });
    expect(html).toContain(">고<");
    expect(html, "아직 받침을 안 찍었는데 목표가 먼저 뜨면 안 된다").not.toContain(
      ">곡<",
    );
  });

  it("오타 칸에는 목표가 아니라 실제로 친 글자가 보인다", () => {
    // 이게 없으면 화면엔 목표만 빨갛게 보여서 뭘 지워야 할지 알 수 없다.
    const html = plate({ typed: "소" });
    expect(html).toContain("소");
  });

  it("목표보다 길게 친 글자도 그린다", () => {
    const html = plate({ typed: "수원시" });
    expect(html).toContain("시");
    expect(html).toContain("1자 더 쳤습니다");
  });

  it("길이가 맞으면 초과 안내가 없다", () => {
    expect(plate({ typed: "수원" })).not.toContain("더 쳤습니다");
  });

  it("가리지 않는 모드에서는 목표가 안내로 남는다", () => {
    const html = plate({ typed: "" });
    expect(html).toContain("수");
    expect(html).toContain("원");
  });
});

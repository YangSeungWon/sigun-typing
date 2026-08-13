import { describe, expect, it } from "vitest";
import { jamoDistance } from "./distance";
import { decomposeChar, initials, joinSyllable, splitSyllable } from "./jamo";
import { cpm, isKeystrokePrefix, keystrokeCount } from "./keystrokes";
import { isOnTrack, matchProgress } from "./match";

describe("splitSyllable / joinSyllable", () => {
  it("받침 없는 음절을 분해한다", () => {
    expect(splitSyllable("가")).toEqual({ cho: "ㄱ", jung: "ㅏ", jong: "" });
  });

  it("겹받침을 분해한다", () => {
    expect(splitSyllable("값")).toEqual({ cho: "ㄱ", jung: "ㅏ", jong: "ㅄ" });
  });

  it("음절이 아니면 null", () => {
    expect(splitSyllable("A")).toBeNull();
    expect(splitSyllable("ㄱ")).toBeNull();
  });

  it("분해 후 재결합하면 원래 글자", () => {
    for (const ch of "안동수원제주광명포천양평값닭흙좌회전") {
      const s = splitSyllable(ch)!;
      expect(joinSyllable(s.cho, s.jung, s.jong)).toBe(ch);
    }
  });
});

describe("decomposeChar — 두벌식 타건 순서", () => {
  it("겹받침을 두 타로 나눈다", () => {
    expect(decomposeChar("값")).toEqual(["ㄱ", "ㅏ", "ㅂ", "ㅅ"]);
    expect(decomposeChar("닭")).toEqual(["ㄷ", "ㅏ", "ㄹ", "ㄱ"]);
  });

  it("복합모음을 두 타로 나눈다", () => {
    expect(decomposeChar("좌")).toEqual(["ㅈ", "ㅗ", "ㅏ"]);
    expect(decomposeChar("의")).toEqual(["ㅇ", "ㅡ", "ㅣ"]);
    expect(decomposeChar("괘")).toEqual(["ㄱ", "ㅗ", "ㅐ"]);
  });

  it("된소리는 한 타 — Shift는 세지 않는다", () => {
    expect(decomposeChar("까")).toEqual(["ㄲ", "ㅏ"]);
    expect(decomposeChar("았")).toEqual(["ㅇ", "ㅏ", "ㅆ"]);
  });

  it("ㅐㅔㅒㅖ는 단독 키다", () => {
    expect(decomposeChar("배")).toEqual(["ㅂ", "ㅐ"]);
    expect(decomposeChar("게")).toEqual(["ㄱ", "ㅔ"]);
  });

  it("한글이 아니면 한 타", () => {
    expect(decomposeChar("A")).toEqual(["A"]);
    expect(decomposeChar(" ")).toEqual([" "]);
  });
});

describe("keystrokeCount", () => {
  it("실제 지역명의 타수", () => {
    expect(keystrokeCount("수원")).toBe(6); // ㅅㅜ + ㅇㅜㅓㄴ
    expect(keystrokeCount("안동")).toBe(6);
    expect(keystrokeCount("제주")).toBe(4);
    expect(keystrokeCount("광명")).toBe(7); // ㄱㅗㅏㅇ + ㅁㅕㅇ
    expect(keystrokeCount("의왕")).toBe(7); // ㅇㅡㅣ ㅇㅗㅏㅇ
  });

  it("공백과 영문도 한 타씩", () => {
    expect(keystrokeCount("가 A")).toBe(4);
  });

  it("빈 문자열은 0타", () => {
    expect(keystrokeCount("")).toBe(0);
  });
});

describe("isKeystrokePrefix", () => {
  it("조합 중인 글자를 접두사로 인정한다", () => {
    expect(isKeystrokePrefix("ㅇ", "안동")).toBe(true);
    expect(isKeystrokePrefix("아", "안동")).toBe(true);
    expect(isKeystrokePrefix("안", "안동")).toBe(true);
    expect(isKeystrokePrefix("안ㄷ", "안동")).toBe(true);
    expect(isKeystrokePrefix("안도", "안동")).toBe(true);
    expect(isKeystrokePrefix("안동", "안동")).toBe(true);
  });

  it("받침이 다음 음절로 넘어가는 중간 상태도 접두사다", () => {
    // 고성: ㄱㅗ → 고, +ㅅ → 곳, +ㅓ → 고서, +ㅇ → 고성
    expect(isKeystrokePrefix("곳", "고성")).toBe(true);
    expect(isKeystrokePrefix("고서", "고성")).toBe(true);
  });

  it("틀린 입력은 접두사가 아니다", () => {
    expect(isKeystrokePrefix("어", "안동")).toBe(false);
    expect(isKeystrokePrefix("안돔", "안동")).toBe(false);
    expect(isKeystrokePrefix("안동시", "안동")).toBe(false);
  });
});

describe("matchProgress", () => {
  it("아무것도 안 쳤으면 전부 untyped", () => {
    const r = matchProgress("안동", "");
    expect(r.statuses).toEqual(["untyped", "untyped"]);
    expect(r.clean).toBe(true);
    expect(r.complete).toBe(false);
  });

  it("조합 중인 글자는 pending이지 오타가 아니다", () => {
    expect(matchProgress("안동", "ㅇ").statuses).toEqual(["pending", "untyped"]);
    expect(matchProgress("안동", "아").statuses).toEqual(["pending", "untyped"]);
    expect(matchProgress("안동", "안").statuses).toEqual(["correct", "untyped"]);
    expect(matchProgress("안동", "안도").statuses).toEqual(["correct", "pending"]);
    expect(matchProgress("안동", "안동").statuses).toEqual(["correct", "correct"]);
  });

  it("받침 이동 중에도 오타로 보지 않는다 — 자모 단위 비교의 핵심", () => {
    const r = matchProgress("고성", "곳");
    expect(r.statuses).toEqual(["correct", "pending"]);
    expect(r.clean).toBe(true);
  });

  it("복합모음 조합 중에도 오타가 아니다", () => {
    // 광명: ㄱㅗ → 고, +ㅏ → 과, +ㅇ → 광
    expect(matchProgress("광명", "고").statuses).toEqual(["pending", "untyped"]);
    expect(matchProgress("광명", "과").statuses).toEqual(["pending", "untyped"]);
    expect(matchProgress("광명", "광").statuses).toEqual(["correct", "untyped"]);
  });

  it("오타를 잡아낸다", () => {
    const r = matchProgress("안동", "안돔");
    expect(r.statuses).toEqual(["correct", "wrong"]);
    expect(r.clean).toBe(false);
  });

  it("첫 오타 이후는 맞아도 회복되지 않는다", () => {
    const r = matchProgress("수원시", "소원시");
    expect(r.statuses[0]).toBe("wrong");
    expect(r.clean).toBe(false);
  });

  it("목표보다 길게 치면 overflow", () => {
    const r = matchProgress("안동", "안동시");
    expect(r.overflow).toBe(2); // ㅅ, ㅣ
    expect(r.clean).toBe(false);
  });

  it("matched는 맞은 타수를 센다 — 정확도 계산용", () => {
    expect(matchProgress("안동", "안").matched).toBe(3);
    expect(matchProgress("안동", "안동").matched).toBe(6);
    expect(matchProgress("안동", "").matched).toBe(0);
  });
});

describe("isOnTrack", () => {
  it("정답으로 가는 중이면 true", () => {
    expect(isOnTrack("포천", "포")).toBe(true);
    expect(isOnTrack("포천", "퐃")).toBe(true); // ㅊ이 아직 종성 자리에 있는 중간 상태
    expect(isOnTrack("포천", "포처")).toBe(true);
  });

  it("빗나가면 false", () => {
    expect(isOnTrack("포천", "표")).toBe(false);
  });
});

describe("cpm", () => {
  it("분당 타수를 계산한다", () => {
    expect(cpm(300, 60_000)).toBe(300);
    expect(cpm(300, 30_000)).toBe(600);
  });

  it("경과 시간이 0이면 0 — 0으로 나누지 않는다", () => {
    expect(cpm(300, 0)).toBe(0);
    expect(cpm(300, -1)).toBe(0);
  });
});

describe("initials — 초성 힌트", () => {
  it("초성만 뽑는다", () => {
    expect(initials("의정부")).toBe("ㅇㅈㅂ");
    expect(initials("서울")).toBe("ㅅㅇ");
    expect(initials("광명")).toBe("ㄱㅁ");
  });

  it("된소리 초성도 그대로 나온다", () => {
    expect(initials("까치")).toBe("ㄲㅊ");
  });

  it("글자 수가 원래와 같다 — 표지판에서 자리를 맞춰야 한다", () => {
    for (const name of ["동두천", "안산", "제주"]) {
      expect([...initials(name)]).toHaveLength([...name].length);
    }
  });

  it("한글이 아니면 그대로 둔다", () => {
    expect(initials("A가")).toBe("Aㄱ");
  });
});

describe("자모 거리", () => {
  it("같으면 0", () => {
    expect(jamoDistance("수원", "수원")).toBe(0);
  });

  it("글자가 아니라 자모로 센다", () => {
    /*
     * 글자 단위로 세면 오타와 착각이 구별되지 않는다 —
     * `수언`과 `성남`이 똑같이 한 글자 차이가 된다.
     */
    expect(jamoDistance("수언", "수원")).toBe(1);
    expect(jamoDistance("성남", "수원")).toBeGreaterThan(1);
  });

  it("접미사가 붙고 빠지는 것도 거리다", () => {
    expect(jamoDistance("강북", "강북구")).toBe(2);
  });

  it("빈 문자열은 상대의 자모 수만큼 멀다", () => {
    expect(jamoDistance("", "구")).toBe(2);
  });
});

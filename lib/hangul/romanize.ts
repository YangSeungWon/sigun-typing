import { isSyllable, splitSyllable } from "./jamo";

/**
 * 국어의 로마자 표기법(2000년 고시)에 따른 변환.
 *
 * 실제 도로표지판의 가장 큰 시각적 특징이 한글 아래 로마자가 붙는 것이다.
 * 다만 표지판 표기는 **글자를 옮겨 적는 것이 아니라 소리를 옮겨 적는 것**이라
 * 자모를 그대로 바꾸면 틀린다 — 강릉은 Gangreung이 아니라 Gangneung이고,
 * 철원은 Cheolwon이 아니라 Cheorwon이다.
 *
 * 그래서 음절 경계에서 일어나는 소리 변화를 먼저 적용하고, 그 다음에 글자를
 * 붙인다. 지명에 실제로 나타나는 변화만 다룬다(비음화·유음화·연음). 표기법에는
 * 구개음화와 ㅎ 축약도 있지만 우리 지명 목록에는 나오지 않고, 어설프게 넣으면
 * 맞던 것까지 틀린다.
 */

const INITIAL: Record<string, string> = {
  ㄱ: "g", ㄲ: "kk", ㄴ: "n", ㄷ: "d", ㄸ: "tt", ㄹ: "r", ㅁ: "m",
  ㅂ: "b", ㅃ: "pp", ㅅ: "s", ㅆ: "ss", ㅇ: "", ㅈ: "j", ㅉ: "jj",
  ㅊ: "ch", ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "h",
};

const VOWEL: Record<string, string> = {
  ㅏ: "a", ㅐ: "ae", ㅑ: "ya", ㅒ: "yae", ㅓ: "eo", ㅔ: "e", ㅕ: "yeo",
  ㅖ: "ye", ㅗ: "o", ㅘ: "wa", ㅙ: "wae", ㅚ: "oe", ㅛ: "yo", ㅜ: "u",
  ㅝ: "wo", ㅞ: "we", ㅟ: "wi", ㅠ: "yu", ㅡ: "eu", ㅢ: "ui", ㅣ: "i",
};

/** 받침이 자음 앞이나 낱말 끝에 올 때의 소리. */
const FINAL: Record<string, string> = {
  "": "", ㄱ: "k", ㄲ: "k", ㄳ: "k", ㄴ: "n", ㄵ: "n", ㄶ: "n", ㄷ: "t",
  ㄹ: "l", ㄺ: "k", ㄻ: "m", ㄼ: "l", ㄽ: "l", ㄾ: "l", ㄿ: "p", ㅀ: "l",
  ㅁ: "m", ㅂ: "p", ㅄ: "p", ㅅ: "t", ㅆ: "t", ㅇ: "ng", ㅈ: "t",
  ㅊ: "t", ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "t",
};

/** 받침이 모음 앞으로 넘어갈 때의 소리. 받침의 'l'이 아니라 첫소리의 'r'이 된다. */
const LIAISON: Record<string, string> = {
  ㄱ: "g", ㄲ: "kk", ㄴ: "n", ㄷ: "d", ㄹ: "r", ㅁ: "m", ㅂ: "b", ㅅ: "s",
  ㅆ: "ss", ㅈ: "j", ㅊ: "ch", ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "",
};

/** 겹받침은 앞은 남고 뒤가 넘어간다. 값 없음 → 홑받침. */
const CLUSTER: Record<string, [string, string]> = {
  ㄳ: ["ㄱ", "ㅅ"], ㄵ: ["ㄴ", "ㅈ"], ㄶ: ["ㄴ", "ㅎ"], ㄺ: ["ㄹ", "ㄱ"],
  ㄻ: ["ㄹ", "ㅁ"], ㄼ: ["ㄹ", "ㅂ"], ㄽ: ["ㄹ", "ㅅ"], ㄾ: ["ㄹ", "ㅌ"],
  ㄿ: ["ㄹ", "ㅍ"], ㅀ: ["ㄹ", "ㅎ"], ㅄ: ["ㅂ", "ㅅ"],
};

/** 앞 음절 받침이 뒤 음절 첫소리와 만나 바뀌는 자리. */
interface Boundary {
  jong: string;
  cho: string;
}

/**
 * 소리 변화.
 *
 *   ㅇ·ㅁ 뒤의 ㄹ → ㄴ      강릉 → 강능    Gangneung
 *   ㄴ + ㄹ, ㄹ + ㄴ, ㄹ + ㄹ → ㄹㄹ   신라 → 실라    Silla
 *   ㄱ·ㅂ 뒤의 ㄴ·ㅁ·ㄹ → 앞이 비음으로   국물 → 궁물
 */
function assimilate({ jong, cho }: Boundary): Boundary {
  if (!jong) return { jong, cho };

  // 유음화
  if (
    (jong === "ㄴ" && cho === "ㄹ") ||
    (jong === "ㄹ" && cho === "ㄴ") ||
    (jong === "ㄹ" && cho === "ㄹ")
  ) {
    return { jong: "ㄹ", cho: "ㄹ" };
  }
  // ㄹ의 비음화 — 앞이 ㅇ·ㅁ이면 ㄹ이 ㄴ으로 바뀐다
  if (cho === "ㄹ" && (jong === "ㅇ" || jong === "ㅁ")) {
    return { jong, cho: "ㄴ" };
  }
  // ㄱ·ㅂ 뒤에서: 뒤의 ㄹ은 ㄴ이 되고, 앞은 같은 자리 비음이 된다
  if (cho === "ㄹ" && (jong === "ㄱ" || jong === "ㅂ")) {
    return { jong: jong === "ㄱ" ? "ㅇ" : "ㅁ", cho: "ㄴ" };
  }
  if ((cho === "ㄴ" || cho === "ㅁ") && (jong === "ㄱ" || jong === "ㅂ")) {
    return { jong: jong === "ㄱ" ? "ㅇ" : "ㅁ", cho };
  }
  return { jong, cho };
}

/**
 * 한 낱말을 로마자로. 한글이 아닌 글자는 그대로 둔다.
 *
 *   romanize("제주")   -> "Jeju"
 *   romanize("강릉")   -> "Gangneung"
 *   romanize("철원")   -> "Cheorwon"
 *   romanize("울릉")   -> "Ulleung"
 */
export function romanize(text: string): string {
  const chars = [...text];
  let out = "";
  /**
   * 앞 음절이 다음 음절에 넘겨 준 첫소리 **글자**.
   *
   * 자모가 아니라 글자를 넘기는 이유: ㄹㄹ에서 뒤의 ㄹ은 첫소리 표기 'r'이
   * 아니라 'l'이어야 한다(울릉 Ulleung). 자모로 넘기면 이 구분이 사라진다.
   */
  let carry: string | null = null;

  for (let i = 0; i < chars.length; i++) {
    const syllable = splitSyllable(chars[i]);
    if (!syllable) {
      out += chars[i];
      carry = null;
      continue;
    }

    const next = i + 1 < chars.length ? splitSyllable(chars[i + 1]) : null;
    const { jung, jong } = syllable;

    out += (carry ?? INITIAL[syllable.cho] ?? "") + (VOWEL[jung] ?? "");
    carry = null;

    if (!next) {
      out += FINAL[jong] ?? "";
      continue;
    }

    /*
     * 뒤 음절이 모음으로 시작하면 받침이 그리로 넘어간다(연음).
     * 다만 받침 ㅇ은 넘어가지 않는다 — 강원은 Gawon이 아니라 Gangwon이다.
     */
    if (next.cho === "ㅇ" && jong && jong !== "ㅇ") {
      const [stay, move] = CLUSTER[jong] ?? ["", jong];
      out += FINAL[stay] ?? "";
      carry = LIAISON[move] ?? "";
      continue;
    }

    const changed = assimilate({ jong, cho: next.cho });
    out += FINAL[changed.jong] ?? "";
    // ㄹㄹ은 'lr'이 아니라 'll'이다.
    if (changed.jong === "ㄹ" && changed.cho === "ㄹ") carry = "l";
    else if (changed.cho !== next.cho) carry = INITIAL[changed.cho] ?? "";
  }

  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** 행정구역 단위. 표기법은 이 앞에 붙임표를 넣도록 한다. */
const UNIT: Record<string, string> = {
  시: "si",
  군: "gun",
  구: "gu",
  도: "do",
  동: "dong",
};

/**
 * 이름 안의 숫자를 표지판처럼 띄운다.
 *
 * 행정동에는 숫자가 흔하다(전국 3,559곳 중 30%). 그대로 이으면
 * `Changsin1`처럼 붙어 버리는데, 실제 표지판은 `Changsin 1`로 띄운다.
 * 숫자는 이름의 일부가 아니라 같은 이름을 나눈 번호이기 때문이다.
 */
function romanizeBase(name: string): string {
  return romanize(name).replace(/(?<=[A-Za-z])(?=\d)/g, " ");
}

/**
 * 지명 하나를 표지판에 적히는 형태로.
 *
 * 이름에 행정구역 단위가 붙어 있으면 그 앞에 붙임표를 넣는다 — 실제 표지판의
 * `Jung-gu`가 그것이다. 다만 글자만 보고는 그게 단위인지 이름의 일부인지
 * 알 수 없다. `중구`의 구는 단위지만 `대구`의 구는 아니고, 둘 다 구로 끝난다.
 * 그래서 코스가 무엇을 세는 단위인지(placeUnit)를 함께 받아 판단한다.
 */
export function romanizeRegion(name: string, placeUnit: string): string {
  const last = name.slice(-1);
  const unit = UNIT[last];
  // 코스가 세는 단위와 같을 때만 단위로 본다. 전국 코스(시도)에서 대구는
  // 구로 끝나지만 그 코스가 세는 단위가 아니므로 Daegu 그대로다.
  if (unit && placeUnit.includes(last) && [...name].length > 1) {
    return `${romanizeBase(name.slice(0, -1))}-${unit}`;
  }
  return romanizeBase(name);
}

/** 한글이 하나도 없으면 로마자를 붙일 이유가 없다. */
export function hasHangul(text: string): boolean {
  return [...text].some(isSyllable);
}

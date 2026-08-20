import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";


/**
 * 가운데점을 구분자로 쓰지 않는다.
 *
 * 값과 값을 `·`로 잇는 것은 대시보드의 문법이다. 읽는 사람에게는 구분자가
 * 아니라 잡음으로 보이고, 남에게 보낼 메시지에서는 기계가 뱉은 것처럼 읽힌다.
 * 줄바꿈과 공백과 자리로 나눈다.
 *
 * ── 왜 정규식을 그만뒀는가 ────────────────────────────────
 * 처음에는 `/ · /`만 막았다. 앞뒤에 공백이 있는 것만 구분자로 보고, 붙여 쓴
 * 것은 한국어 병렬 표기로 봤다. 그런데 실제로 샌 것 둘은 전부 붙어 있었다 —
 * `맞힌 타수·오타·첫 입력·힌트`와 `제주·제주도·제주특별자치도`. 공백은 신호가
 * 아니었다.
 *
 * 그래서 반대로 뒤집는다. **행정 단위를 잇는 것만 통과시키고 나머지는 다
 * 막는다.** `구·군`, `시·도`, `읍·면·동`은 한 낱말처럼 쓰이는 굳은 표기라
 * 값의 나열이 아니다. 그 밖의 무엇을 잇든 그건 나열이고, 나열은 줄바꿈이
 * 하는 일이다.
 *
 * 마지막 마디에는 조사가 붙을 수 있다(`시·도부터`). 그것까지 막으면 규칙이
 * 문장을 못 쓰게 만든다.
 */
const ADMIN_UNIT = "[시도군구읍면동]";
const MIDDLE_DOT_OK = new RegExp(`^${ADMIN_UNIT}(?:·${ADMIN_UNIT})+[가-힣]*$`);

/** 가운데점이 낀 덩어리. 앞뒤로 공백이 아닌 것을 끝까지 붙여 잡는다. */
const MIDDLE_DOT_RUN = /[^\s]*·[^\s]*/g;

const middleDot = {
  rules: {
    "no-middle-dot": {
      meta: {
        type: "problem",
        docs: { description: "화면에 나가는 문장에서 가운데점을 구분자로 쓰지 않는다." },
        schema: [],
      },
      create(context) {
        const check = (node, text) => {
          if (typeof text !== "string" || !text.includes("·")) return;
          for (const [run] of text.matchAll(MIDDLE_DOT_RUN)) {
            if (MIDDLE_DOT_OK.test(run)) continue;
            context.report({
              node,
              message: `가운데점을 구분자로 쓰지 않는다(${run}). 줄바꿈이나 공백, 자리로 나눈다.`,
            });
            return;
          }
        };
        return {
          JSXText: (node) => check(node, node.value),
          Literal: (node) => check(node, node.value),
          TemplateElement: (node) => check(node, node.value.raw),
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  {
    /*
     * 약관과 개인정보 처리방침은 뺀다. 거기는 `행정·법률·학술`, `사칭·비방`처럼
     * 낱말을 잇는 법률 문체가 자연스러운 자리이고, 이 규칙이 막으려는 것은
     * 화면에서 값을 늘어놓는 쪽이다.
     *
     * 주석은 애초에 안 걸린다 — 선택자가 문자열과 JSX 글자만 본다. 하나씩
     * 발견할 때마다 고치다 보면 다시 새는 종류라 규칙으로 박아 둔다.
     */
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: [
      "app/**/terms/**",
      "app/**/privacy/**",
      // 검사는 화면이 아니다. 검사 이름과 `·가 없다`를 확인하는 문자열이 걸린다.
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    plugins: { "sigun": middleDot },
    rules: { "sigun/no-middle-dot": "error" },
  },
]);

export default eslintConfig;

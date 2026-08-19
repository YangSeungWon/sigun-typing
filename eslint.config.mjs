import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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

  /**
   * 화면에 나가는 문장에 가운데점을 구분자로 쓰지 않는다.
   *
   * 값과 값을 `·`로 잇는 것은 대시보드의 문법이다. 읽는 사람에게는 구분자가
   * 아니라 잡음으로 보이고, 특히 남에게 보낼 메시지에서는 기계가 뱉은 것처럼
   * 읽힌다. 줄바꿈·공백·자리로 나눈다.
   *
   * **공백이 낀 것만 막는다.** `행정·법률·학술`이나 `제주·제주도`처럼 붙여 쓴
   * 것은 한국어 병렬 표기라 정상이다. 구분자로 쓸 때만 앞뒤에 공백이 붙는다.
   *
   * 주석은 안 걸린다 — 선택자가 문자열과 JSX 글자만 본다. 하나씩 발견할 때마다
   * 고치다 보면 다시 새는 종류라 규칙으로 박아 둔다.
   */
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXText[value=/ · /]",
          message: "가운데점을 구분자로 쓰지 않는다. 줄바꿈이나 공백, 자리로 나눈다.",
        },
        {
          selector: "Literal[value=/ · /]",
          message: "가운데점을 구분자로 쓰지 않는다. 줄바꿈이나 공백, 자리로 나눈다.",
        },
        {
          selector: "TemplateElement[value.raw=/ · /]",
          message: "가운데점을 구분자로 쓰지 않는다. 줄바꿈이나 공백, 자리로 나눈다.",
        },
      ],
    },
  },
]);

export default eslintConfig;

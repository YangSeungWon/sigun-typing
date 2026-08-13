import { readText, remove, writeText } from "./storage";

/**
 * 밝은 판 / 어두운 판.
 *
 * 기본은 시스템 설정이고, 그건 CSS만으로 돈다(`prefers-color-scheme`).
 * 여기 있는 코드는 **시스템과 다르게 쓰겠다고 고른 사람**만을 위한 것이다.
 *
 * 그래서 `system`은 저장하지도 않고 속성으로 붙이지도 않는다 — 속성이 없는
 * 상태가 곧 시스템 설정이다. 값을 하나 더 만들면 자바스크립트가 꺼진 브라우저와
 * 켜진 브라우저가 다른 규칙을 타게 된다.
 */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "sigun:theme:v1";

/** 브라우저 UI(주소창 등) 색. 값 자체는 globals.css의 --sig-concrete와 같아야 한다. */
const CHROME_COLOR: Record<"light" | "dark", string> = {
  light: "#dee0db",
  dark: "#060d12",
};

/**
 * 첫 페인트 전에 도는 코드.
 *
 * 문자열로 두는 이유: 이건 React가 하이드레이션하기 **전에**, 파서가
 * `<head>`를 읽는 동안 실행되어야 한다. 번들에 넣어 나중에 돌리면 이미
 * 밝은 화면이 한 번 그려진 뒤라 눈에 보이게 깜빡인다.
 *
 * 짧아야 한다. 여기서 하는 일은 속성 하나를 붙이는 것뿐이고, 저장소 접근이
 * 막힌 환경에서도(사생활 보호 모드) 조용히 지나가야 한다.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?${JSON.stringify(CHROME_COLOR.dark)}:${JSON.stringify(CHROME_COLOR.light)});}}catch(e){}`;

export function themeChoice(): ThemeChoice {
  const stored = readText(THEME_KEY);
  return stored === "dark" || stored === "light" ? stored : "system";
}

/** 지금 실제로 어느 판인가. 고른 값이 없으면 시스템에 물어본다. */
export function resolvedTheme(choice: ThemeChoice = themeChoice()): "light" | "dark" {
  if (choice !== "system") return choice;
  if (typeof matchMedia !== "function") return "light";
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setThemeChoice(choice: ThemeChoice): void {
  /*
   * 저장이 실패해도 속성은 붙인다. 다음 방문에 잊힐 뿐, **이번 화면은
   * 고른 대로 보여야 한다** — 저장소 실패가 화면을 되돌리면 버튼이 고장 난
   * 것처럼 보인다.
   */
  if (choice === "system") {
    remove(THEME_KEY);
    delete document.documentElement.dataset.theme;
  } else {
    writeText(THEME_KEY, choice);
    document.documentElement.dataset.theme = choice;
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", CHROME_COLOR[resolvedTheme(choice)]);
}

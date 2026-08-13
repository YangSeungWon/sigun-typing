import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 첫 화면은 말을 적게 한다.
 *
 * 이 서비스에서 콘텐츠는 지도와 숫자다. 그 위에 문장을 얹을수록 게임 인터페이스가
 * 아니라 앱 마케팅처럼 읽힌다 — `대한민국의 33%를 기억하고 있어요`보다
 * `82 / 245 · 정복도 33%`가 짧고, 정확하고, 무엇보다 이 제품의 말투다.
 *
 * 아래 목록은 **어느 제품에 붙여도 말이 되는 문장들**이다. 그게 걸러 내려는
 * 것이고, 그래서 문법이 아니라 상투구를 본다.
 *
 * 기준 하나: 이 문장을 지워도 다음에 뭘 할지 알 수 있다면 지운다.
 */
const BANNED = [
  "해보세요",
  "해 보세요",
  "당신의",
  "준비가 되셨",
  "실력을 확인",
  "여정을 시작",
  "함께 해요",
  "재미있게",
  "마스터",
];

const ROOT = join(import.meta.dirname, "..", "..");

function sources(dir: string) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !e.name.includes(".test."))
    .map((e) => ({
      path: `${dir}/${e.name}`,
      code: readFileSync(join(ROOT, dir, e.name), "utf8"),
    }));
}

describe("첫 화면 문구", () => {
  const files = sources("components/home");

  it("검사할 파일이 있다", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const phrase of BANNED) {
    it(`"${phrase}"를 쓰지 않는다`, () => {
      for (const file of files) {
        expect(file.code, `${file.path}`).not.toContain(phrase);
      }
    });
  }
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 첫 화면의 클라이언트 쪽은 코스 데이터를 모른다.
 *
 * `data/courses/`는 소스 92KB — 245개 지역의 코드·이름·별칭이다. 첫 화면이
 * 쓰는 것은 코스당 다섯 값(1KB 미만)이고, 그래서 서버가 `buildHomeSeed`로
 * 깎아 내려보낸다. 클라이언트 컴포넌트 하나가 무심코 `getCourse`를 부르면
 * 그 배관이 통째로 무의미해지는데, 화면은 멀쩡히 돌아서 아무도 모른다.
 *
 * 주석으로 적어 두면 한 달 안에 깨진다. 이 리포가 의도를 테스트에 박아 두는
 * 습관을 따른다(`data/courses/codes.test.ts`가 같은 일을 한다).
 */
const ROOT = join(import.meta.dirname, "..", "..");

function sourcesIn(dir: string): { path: string; code: string }[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !e.name.includes(".test."))
    .map((e) => ({
      path: `${dir}/${e.name}`,
      code: readFileSync(join(ROOT, dir, e.name), "utf8"),
    }));
}

describe("첫 화면 번들", () => {
  const files = [...sourcesIn("components/home"), ...sourcesIn("lib/home")]
    // summary.ts는 서버에서만 돈다. 코스를 얇게 깎는 것이 그 파일의 일이다.
    .filter((f) => f.path !== "lib/home/summary.ts");

  it("검사할 파일이 있다", () => {
    // 폴더 이름이 바뀌면 위 목록이 조용히 비어서 이 테스트가 늘 통과한다.
    expect(files.length).toBeGreaterThan(3);
  });

  it("코스 데이터를 import하지 않는다", () => {
    for (const file of files) {
      expect(file.code, `${file.path}가 코스 데이터를 끌어온다`).not.toMatch(
        /from ["']@\/data\/courses/,
      );
    }
  });

  it("코스 지도 목록도 끌어오지 않는다", () => {
    // data/thumbs.json 68KB. 목록과 함께 첫 화면을 떠났다.
    for (const file of files) {
      expect(file.code, `${file.path}가 썸네일을 끌어온다`).not.toMatch(
        /from ["']@\/data\/thumbs/,
      );
    }
  });
});

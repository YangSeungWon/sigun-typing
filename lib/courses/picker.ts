import { COURSES } from "@/data/courses";
import type { Course } from "@/data/types";

/**
 * 코스 270개를 select 하나에 담을 때 쓰는 묶음.
 *
 * 칩으로 다 깔면 고르는 자리가 아니라 뒤지는 자리가 된다. 목록을 한 줄에
 * 담는 물건이 select이고, 그러려면 묶음이 있어야 한다.
 *
 * 전국 둘과 시도 열일곱이 이 게임의 사다리라 위에 온다. 읍면동 252개는 그
 * 아래 시도별로 나눈다 — `중구 9개 동`이 부산인지 대구인지는 이름만 봐서 알
 * 수 없고, parentName의 앞 토막이 그 답이다.
 */
export const COURSE_PICKER_GROUPS: { label: string; courses: Course[] }[] = (() => {
  const ladder = COURSES.filter((c) => c.level !== "dong");
  const groups = [
    { label: "전국", courses: ladder.filter((c) => c.group === "nationwide") },
    { label: "시도", courses: ladder.filter((c) => c.group !== "nationwide") },
  ];
  for (const c of COURSES.filter((c) => c.level === "dong")) {
    const label = c.parentName?.split(" ")[0] ?? "읍면동";
    const hit = groups.find((g) => g.label === label);
    if (hit) hit.courses.push(c);
    else groups.push({ label, courses: [c] });
  }
  return groups.filter((g) => g.courses.length > 0);
})();

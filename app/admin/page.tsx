import type { Metadata } from "next";
import { AdminNames } from "@/components/AdminNames";

/**
 * 최근 올라온 이름을 훑는 자리.
 *
 * 랭킹 페이지는 코스마다 상위 몇 줄만 보여 준다. 그래서 **상위권에 못 든
 * 이상한 이름은 아예 안 보였다** — 이름 검사를 통과한 것이 순위와 무관하게
 * 쌓이고 있는데, 그것을 볼 화면이 없었다.
 *
 * 셸(헤더·탭 바) 밖에 둔다. 이건 사이트의 화면이 아니라 도구다.
 */
export const metadata: Metadata = {
  title: "이름 훑기",
  // 색인되지 않는다. robots.ts에도 함께 적어 두었다 — 둘 다 있어야 한다.
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10"
    >
      <AdminNames />
    </main>
  );
}

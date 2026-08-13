"use client";

import Link from "next/link";
import { COURSES } from "@/data/courses";
import { loadAllMistakes } from "@/lib/score/mistakes";
import { useIsHydrated } from "@/lib/useIsHydrated";

/**
 * 여러 코스에 흩어진 헷갈리는 곳으로 가는 길.
 *
 * `헷갈리는 지역` 페이지는 있는데 첫 화면에서 갈 길이 없었다. 코스를 하나
 * 열면 그 코스의 것만 보이므로, 서울에서 셋·경기에서 넷을 헷갈린 사람은
 * 그 일곱 곳을 한자리에서 볼 방법이 없었다.
 *
 * 그렇다고 첫 화면 위에 `오늘의 복습` 같은 상자를 두지는 않는다. 한때 그런
 * 카드가 있었고 뺐다 — 지도를 고르러 온 사람에게 개인 대시보드가 먼저 나오면
 * 이 서비스가 무엇인지 흐려진다. 문 하나면 충분하다.
 *
 * 헷갈린 적이 없으면 아예 나오지 않는다. 첫 방문자에게 빈 방으로 가는 문을
 * 열어 둘 이유가 없다.
 */
export function NotesLink() {
  const hydrated = useIsHydrated();
  if (!hydrated) return null;

  const count = loadAllMistakes(COURSES.map((c) => c.id)).reduce(
    (sum, entry) => sum + entry.records.length,
    0,
  );
  if (count === 0) return null;

  return (
    <Link href="/notes" className="text-alert transition-colors hover:text-ink">
      헷갈리는 지역 {count}
    </Link>
  );
}

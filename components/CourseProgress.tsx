"use client";

import { loadMistakes } from "@/lib/score/mistakes";
import { loadPersonalBest } from "@/lib/score/personalBest";
import { useIsHydrated } from "@/lib/useIsHydrated";

interface CourseProgressProps {
  courseId: string;
  courseVersion: number;
  /** 코스에 든 지역 수. 기록이 없을 때도 이 값은 안다. */
  total: number;
  /**
   * 이 코스의 1위 기록(밀리초). 아무도 올리지 않았으면 없다.
   *
   * 처음 온 사람에게는 "이 코스는 이 정도 걸린다"는 감이 되고, 해 본 사람에게는
   * 목표가 된다. 서버에서 읽어 넘긴다 — 남의 기록이라 이 브라우저에는 없다.
   */
  topMs?: number;
}

/** 00:00 — 카드에서는 100분의 1초까지 읽을 이유가 없다. */
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 코스 카드에 붙는 내 진행.
 *
 * 목록에서 "어디까지 했는지"가 안 보였다. 처음 온 사람에게는 열일곱 코스가
 * 다 같아 보이고, 다시 온 사람에게는 어디를 이어서 해야 할지 단서가 없다.
 * 이 한 줄이 코스 목록을 메뉴에서 **진행판**으로 바꾼다.
 *
 * 해 본 적이 없으면 아무것도 그리지 않는다. 첫 방문자의 목록은 깨끗해야
 * 하고, `0/25 · 시작 안 함`을 열일곱 줄 늘어놓는 것은 정보가 아니라 소음이다.
 *
 * 기록은 이 브라우저에만 있다(개인 기록·오답노트). 서버에서 그릴 수 없으므로
 * 하이드레이션이 끝난 뒤에 붙는다 — 첫 렌더에 그리면 서버 HTML과 어긋난다.
 */
export function CourseProgress({
  courseId,
  courseVersion,
  total,
  topMs,
}: CourseProgressProps) {
  const hydrated = useIsHydrated();
  // 내 기록은 이 브라우저에만 있다. 1위는 서버에서 왔으므로 먼저 그려도 된다.
  const best = hydrated ? loadPersonalBest(courseId, "map", courseVersion) : null;
  const stuck = hydrated ? loadMistakes(courseId).length : 0;
  if (!best && stuck === 0 && topMs === undefined) return null;

  return (
    <span className="flex flex-wrap items-baseline gap-x-3 font-mono text-sm text-dim">
      {best && (
        <span className="tabular-nums">
          {/*
            완주 수를 앞에 둔다. 순위를 가르는 첫 기준이고, 다 돌지 못한 판에서
            시간만 보면 많이 건너뛴 판이 더 좋아 보인다.
          */}
          {best.completed === total ? (
            <span className="text-sign-deep">완주</span>
          ) : (
            `${best.completed}/${total}`
          )}
          <span className="ml-2">{clock(best.elapsedMs)}</span>
        </span>
      )}
      {stuck > 0 && (
        /*
          다시 볼 곳이 남아 있다는 것은 다음에 뭘 할지 알려 주는 말이다.

          빨강은 쓰지 않는다. 그 색은 지금 틀렸다는 신호이고(SignPlate 참조),
          이 숫자는 지난 일이다. 줄의 나머지와 같은 흐린색으로 둔다 —
          `완주`의 초록만 이 줄에서 색을 갖는다.
        */
        <span>헷갈리는 곳 {stuck}</span>
      )}
      {topMs !== undefined && (
        /*
          `최고`가 아니라 `1위`라고 적는다. 옆에 내 기록이 있으므로 둘 다
          "최고"라고 부르면 어느 것이 내 것인지 알 수 없다.
        */
        <span className="tabular-nums">1위 {clock(topMs)}</span>
      )}
    </span>
  );
}

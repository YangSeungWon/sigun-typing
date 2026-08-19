"use client";

import type { ItemResult, ModeId, Score } from "@/lib/game/types";
import {
  marksFor,
  renderGrid,
  shareText,
  spokenDuration,
  type CourseGrid,
} from "@/lib/share/grid";
import { encodeMarks } from "@/lib/game/marks";
import { fitsTweet } from "@/lib/share/x";
import { track } from "@/lib/analytics/track";
import { getSavedNickname } from "@/lib/score/client";
import { ShareCard } from "./share/ShareCard";

interface ShareResultProps {
  courseId: string;
  courseName: string;
  mode: ModeId;
  score: Score;
  /** 이모지 격자 자리표. 없는 코스면 null이고 숫자만 나간다. */
  grid: CourseGrid | null;
  /** 지역별 결과. 어느 칸을 무슨 색으로 칠할지가 여기서 나온다. */
  results: ItemResult[];
}

/**
 * 자랑하기.
 *
 * 이 게임의 성장 고리에서 비어 있던 칸이다. 결과 화면에는 이미 자랑할 숫자가
 * 다 있는데(몇 초, 몇 곳, 몇 타) 내보낼 길이 없었다.
 *
 * 그냥 주소를 복사하는 것과 다른 점 하나: 링크에 **내 기록을 실어 보낸다.**
 * 받은 사람은 홈이 아니라 "이 기록에 도전합니다" 화면으로 떨어진다. 링크를
 * 보내는 이유가 소개가 아니라 도발이 되고, 그게 이런 게임이 퍼지는 방식이다.
 *
 * 보내는 길(시트·카카오·X·복사)은 `ShareCard`가 안다. 여기가 정하는 것은
 * **무엇을 보낼지**뿐이다.
 */
export function ShareResult({
  courseId,
  courseName,
  mode,
  score,
  grid,
  results,
}: ShareResultProps) {
  // 완주하지 못한 판은 도전장이 되지 않는다.
  if (score.completed === 0) return null;

  /*
   * 기록을 쿼리가 아니라 **경로**에 담는다(`/c/map/seoul/41080~JAZg/승원`).
   * 그래야 서버가 링크만 보고 미리보기 카드에 기록을 실을 수 있다 — 쿼리로 두면
   * `/play/...` 807개가 통째로 정적 생성에서 빠진다. 자세한 사정은 그 경로의
   * page.tsx에 적어 두었다.
   *
   * `~` 뒤는 지역별 결과 꾸러미다. 카드 그림의 지도가 이모지 격자와 같은 색으로
   * 칠해지는 것이 이 값 덕이다. 이름은 렌더 중에 읽어도 된다 — localStorage가
   * 아니라 이미 읽어 둔 값이다.
   */
  const nickname = getSavedNickname().trim().slice(0, 12);
  const marks = grid ? encodeMarks(marksFor(grid, results)) : "";
  const beat = String(Math.round(score.elapsedMs)) + (marks ? `~${marks}` : "");
  const path = `/c/${[mode, courseId, beat, ...(nickname ? [encodeURIComponent(nickname)] : [])].join("/")}`;

  const body = {
    courseName,
    grid,
    results,
    completed: score.completed,
    total: score.total,
    elapsedMs: score.elapsedMs,
    hintsUsed: score.hintsUsed,
  };
  const text = shareText(body);

  /*
   * X는 280자다. 전국 229 시군구는 격자만으로 741이라 안 들어간다 — 그때는
   * 격자를 뺀다. 자르면 반쯤 잘린 지도가 되고, 그건 자랑하려던 사람에게 가장
   * 나쁜 결과다. 링크를 펼치면 카드에 지도가 있다.
   */
  const lean = shareText({ ...body, grid: null });

  return (
    <ShareCard
      text={text}
      path={path}
      query="from=challenge"
      imagePath={grid ? `${path}/opengraph-image` : null}
      tweet={fitsTweet(text) ? text : lean}
      kakao={{
        title: `${courseName} ${spokenDuration(score.elapsedMs)}`,
        description:
          score.completed === score.total
            ? `${score.total}곳 전부, 같이 한 판?`
            : `${score.total}곳 중 ${score.completed}곳, 같이 한 판?`,
      }}
      onShare={() =>
        track({ name: "share_clicked", courseId, mode, elapsedMs: score.elapsedMs })
      }
      preview={
        grid && (
          /*
            보낼 것을 보여 준다. 이 게임의 공유물은 링크가 아니라 이 그림이다 —
            주인공이 카카오톡이나 X가 아니라 자기 판이어야 한다.

            코스명과 기록은 안 적는다. 바로 위 표지판이 이미 그 말을 하고 있다.
          */
          <pre
            aria-hidden
            className="overflow-hidden text-center text-[10px] leading-[1.15] break-keep whitespace-pre sm:text-xs"
          >
            {renderGrid(grid, results)}
          </pre>
        )
      }
    />
  );
}

"use client";

import { useState } from "react";
import type { ItemResult, ModeId, Score } from "@/lib/game/types";
import { shareText, spokenDuration, type CourseGrid } from "@/lib/share/grid";
import { KAKAO_KEY, sendKakao } from "@/lib/share/kakao";
import { track } from "@/lib/analytics/track";
import { getSavedNickname } from "@/lib/score/client";

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
 * 기록을 주소에 담는 이유(서버에 저장하지 않는 이유): 도전 카드를 만들자고
 * 남의 기록과 닉네임을 서버에 쌓을 이유가 없다. 주소에 든 값은 화면에 띄우는
 * 문구일 뿐 순위에는 아무 영향도 주지 않으므로, 남이 고쳐 봐야 자기 화면의
 * 목표 시간만 바뀐다.
 */
export function ShareResult({
  courseId,
  courseName,
  mode,
  score,
  grid,
  results,
}: ShareResultProps) {
  const [copied, setCopied] = useState(false);

  // 완주하지 못한 판은 도전장이 되지 않는다.
  if (score.completed === 0) return null;

  /**
   * 주소는 눌렀을 때 만든다. 렌더 중에 window를 읽으면 서버 렌더와 어긋난다.
   *
   * 기록을 쿼리가 아니라 **경로**에 담는다(`/c/map/seoul/41080/승원`). 그래야
   * 서버가 링크만 보고 미리보기 카드에 기록을 실을 수 있다 — 쿼리로 두면
   * `/play/...` 807개가 통째로 정적 생성에서 빠진다. 자세한 사정은 그 경로의
   * page.tsx에 적어 두었다.
   */
  const challengeUrl = () => {
    const nickname = getSavedNickname().trim().slice(0, 12);
    const parts = [mode, courseId, String(Math.round(score.elapsedMs))];
    if (nickname) parts.push(encodeURIComponent(nickname));
    return `${window.location.origin}/c/${parts.join("/")}?from=challenge`;
  };

  /*
   * 숫자만 적던 자리다. 정확도 소수점 한 자리는 보내는 사람도 받는 사람도
   * 읽지 않는데, 격자는 한눈에 읽힌다 — 어디서 막혔는지가 모양으로 보인다.
   */
  const text = shareText({
    courseName,
    grid,
    results,
    completed: score.completed,
    total: score.total,
    elapsedMs: score.elapsedMs,
    hintsUsed: score.hintsUsed,
  });

  const share = async () => {
    track({ name: "share_clicked", courseId, mode, elapsedMs: score.elapsedMs });
    const url = challengeUrl();

    // 모바일에서는 공유 시트가 카톡·메시지로 바로 간다. 데스크톱에는 없다.
    if (navigator.share) {
      try {
        await navigator.share({ title: "시군 타이핑", text, url });
        return;
      } catch {
        // 사용자가 공유창을 닫은 것이다. 복사로 떨어뜨릴 이유는 없다.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드가 막힌 환경. 주소창에서 직접 복사하는 수밖에 없다.
    }
  };

  /*
   * 카카오톡은 다른 물건을 보낸다.
   *
   * 위의 공유는 **격자**를 보낸다 — 내 판이 어떻게 생겼는지. 카카오 카드는
   * 격자를 담을 수 없어서(설명이 두 줄에서 잘린다) 대신 제목에 기록을 박은
   * 초대장을 보낸다. 둘 다 남겨 두는 이유가 이것이다.
   *
   * 키가 없으면 단추가 아예 없다. 카카오 콘솔에 도메인을 등록하지 않은 채
   * 누르면 SDK가 거절하는데, 그때는 조용히 위의 길로 떨어진다.
   */
  const kakao = async () => {
    track({ name: "share_clicked", courseId, mode, elapsedMs: score.elapsedMs });
    const ok = await sendKakao({
      title: `${courseName} ${spokenDuration(score.elapsedMs)}`,
      description:
        score.completed === score.total
          ? `${score.total}곳 전부, 같이 한 판?`
          : `${score.total}곳 중 ${score.completed}곳, 같이 한 판?`,
      url: challengeUrl(),
      imageUrl: `${window.location.origin}/og.png`,
    });
    if (!ok) await share();
  };

  return (
    /*
     * 선 아래에서는 아무것도 "한 번 더"와 경쟁하지 않아야 한다. 초록 테두리는
     * 이 화면에서 주 행동의 표시고, 여기 것들은 테두리만 두른다.
     */
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={share}
        className="flex-1 rounded-lg border border-concrete-deep px-5 py-3 font-medium text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {copied ? "복사했습니다 — 붙여 넣어 보내세요" : "결과 보내기"}
      </button>

      {KAKAO_KEY && (
        <button
          type="button"
          onClick={kakao}
          className="rounded-lg border border-concrete-deep px-5 py-3 font-medium text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          카카오톡
        </button>
      )}
    </div>
  );
}

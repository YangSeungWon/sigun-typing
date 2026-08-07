"use client";

import { useState } from "react";
import type { ModeId, Score } from "@/lib/game/types";
import { track } from "@/lib/analytics/track";
import { getSavedNickname } from "@/lib/score/client";
import { formatClock } from "./Odometer";

interface ShareResultProps {
  courseId: string;
  courseName: string;
  mode: ModeId;
  score: Score;
}

function formatPrecise(ms: number): string {
  return `${formatClock(ms)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;
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
export function ShareResult({ courseId, courseName, mode, score }: ShareResultProps) {
  const [copied, setCopied] = useState(false);

  // 완주하지 못한 판은 도전장이 되지 않는다.
  if (score.completed === 0) return null;

  /** 주소는 눌렀을 때 만든다. 렌더 중에 window를 읽으면 서버 렌더와 어긋난다. */
  const challengeUrl = () => {
    const nickname = getSavedNickname().trim();
    const params = new URLSearchParams({ beat: String(Math.round(score.elapsedMs)) });
    if (nickname) params.set("by", nickname.slice(0, 12));
    return `${window.location.origin}/play/${mode}/${courseId}?${params}&from=challenge`;
  };

  const text =
    `${courseName} ${formatPrecise(score.elapsedMs)}\n` +
    `${score.completed}/${score.total} · 정확도 ${(score.accuracy * 100).toFixed(1)}% · ` +
    `${Math.round(score.cpm)}타/분\n\n` +
    `너는 나보다 빠름?`;

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

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-lg border border-sign bg-sign/10 px-5 py-3 font-medium text-ink transition-colors hover:bg-sign/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {copied ? "복사했습니다 — 붙여 넣어 보내세요" : "내 기록으로 도전장 보내기"}
    </button>
  );
}

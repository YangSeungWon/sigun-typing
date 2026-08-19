"use client";

import { useEffect, useState } from "react";
import type { ItemResult, ModeId, Score } from "@/lib/game/types";
import {
  marksFor,
  renderGrid,
  shareText,
  spokenDuration,
  type CourseGrid,
} from "@/lib/share/grid";
import { encodeMarks } from "@/lib/game/marks";
import { KAKAO_KEY, sendKakao } from "@/lib/share/kakao";
import { fitsTweet, tweetUrl } from "@/lib/share/x";
import { BrandMark, ShareOption } from "./share/ShareOption";
import { BRAND_PATH } from "./share/brandPaths";
import { track } from "@/lib/analytics/track";
import { getSavedNickname } from "@/lib/score/client";
import { useIsHydrated } from "@/lib/useIsHydrated";

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
  /*
   * 공유 시트가 있는 기기인가. 서버는 모르는 값이라 하이드레이션 뒤에 본다 —
   * 렌더 중에 navigator를 읽으면 서버가 그린 것과 어긋난다.
   */
  const hydrated = useIsHydrated();
  const canShare = hydrated && typeof navigator.share === "function";

  /**
   * 주소는 눌렀을 때 만든다. 렌더 중에 window를 읽으면 서버 렌더와 어긋난다.
   *
   * 기록을 쿼리가 아니라 **경로**에 담는다(`/c/map/seoul/41080/승원`). 그래야
   * 서버가 링크만 보고 미리보기 카드에 기록을 실을 수 있다 — 쿼리로 두면
   * `/play/...` 807개가 통째로 정적 생성에서 빠진다. 자세한 사정은 그 경로의
   * page.tsx에 적어 두었다.
   */
  const challengePath = () => {
    const nickname = getSavedNickname().trim().slice(0, 12);
    /*
     * 기록 뒤에 `~`로 상태 꾸러미를 붙인다. 그래야 카드 그림의 지도도 이모지
     * 격자와 같은 색으로 칠해진다 — 서버가 아는 것은 주소뿐이다.
     *
     * 세그먼트를 새로 만들지 않고 기록 칸에 붙이는 이유는 경로 모양을 그대로
     * 두기 위해서다. 이미 나간 링크(`.../41080/승원`)에는 `~`가 없고, 그것도
     * 그대로 열린다. base64url에 `~`가 없어서 갈라도 안전하다.
     */
    const marks = grid ? encodeMarks(marksFor(grid, results)) : "";
    const beat = String(Math.round(score.elapsedMs)) + (marks ? `~${marks}` : "");
    const parts = [mode, courseId, beat];
    if (nickname) parts.push(encodeURIComponent(nickname));
    return `/c/${parts.join("/")}`;
  };

  const challengeUrl = () => `${window.location.origin}${challengePath()}?from=challenge`;

  /**
   * 넘길 그림. **미리 받아 둔다.**
   *
   * 사파리는 `navigator.share`를 사용자 제스처 안에서 부르라고 요구한다. 누른
   * 뒤에 그림을 받아 오면 그 사이에 활성화 창이 지나 거부된다 — 눌렀는데
   * 아무 일도 안 일어나는 화면이 된다. 그래서 결과가 뜨는 순간 받아 두고,
   * 누를 때는 이미 손에 있는 것을 넘긴다.
   *
   * 새로 그리지 않는다. 도전장 링크의 미리보기 카드가 정확히 이 그림이다 —
   * 표지판에 코스명과 기록, 옆에 이 판이 색칠된 지도. 링크를 펼쳤을 때 뜨는
   * 것과 공유 시트로 넘어가는 것이 같은 그림이어야 한다.
   *
   * 못 받아도 조용히 넘어간다. 그림 없이 글만 가는 것이 아무것도 못 보내는
   * 것보다 낫다.
   */
  const [card, setCard] = useState<File | null>(null);
  useEffect(() => {
    if (!canShare || !grid || typeof navigator.canShare !== "function") return;
    let alive = true;
    void fetch(`${challengePath()}/opengraph-image`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!alive || !blob) return;
        const file = new File([blob], "sigun-typing.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) setCard(file);
      })
      .catch(() => {
        // 망이 끊겼거나 서버가 늦다. 글만 보낸다.
      });
    return () => {
      alive = false;
    };
    // challengePath는 렌더마다 새로 만들어지지만 값은 이 판에서 고정이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShare, grid, courseId, mode, score.elapsedMs]);

  // 완주하지 못한 판은 도전장이 되지 않는다.
  if (score.completed === 0) return null;


  /*
   * 숫자만 적던 자리다. 정확도 소수점 한 자리는 보내는 사람도 받는 사람도
   * 읽지 않는데, 격자는 한눈에 읽힌다 — 어디서 막혔는지가 모양으로 보인다.
   */
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

  const mark = () =>
    track({ name: "share_clicked", courseId, mode, elapsedMs: score.elapsedMs });

  const copy = async (payload: string) => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드가 막힌 환경. 주소창에서 직접 복사하는 수밖에 없다.
    }
  };

  /**
   * 기기가 주는 공유 시트.
   *
   * 여기서만 카톡·문자·인스타가 한꺼번에 뜬다. 데스크톱 브라우저에는 이 API가
   * 없어서 아예 칸을 안 낸다 — 여태 이 자리가 `결과 보내기`라는 이름으로
   * 데스크톱에서는 복사를 하고 있었고, 누르는 사람은 무슨 일이 날지 몰랐다.
   */
  const share = async () => {
    mark();
    const payload = { title: "시군 타이핑", text, url: challengeUrl() };
    try {
      await navigator.share(card ? { ...payload, files: [card] } : payload);
    } catch {
      // 공유창을 닫은 것이다. 복사로 떨어뜨릴 이유는 없다.
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
    mark();
    const ok = await sendKakao({
      title: `${courseName} ${spokenDuration(score.elapsedMs)}`,
      description:
        score.completed === score.total
          ? `${score.total}곳 전부, 같이 한 판?`
          : `${score.total}곳 중 ${score.completed}곳, 같이 한 판?`,
      url: challengeUrl(),
      imageUrl: `${window.location.origin}/og.png`,
    });
    // 도메인 미등록이나 SDK 실패. 조용히 붙여 넣을 수 있게 떨어뜨린다.
    if (!ok) await copy(`${text}\n${challengeUrl()}`);
  };

  /*
   * X는 작성창을 채운 채로 연다.
   *
   * 데스크톱에는 공유 시트가 없어서, 이것 없이는 복사하고 X를 열고 붙여넣는
   * 세 단계다. 280자에 격자가 안 들어가는 코스(전국 229 시군구는 격자만으로
   * 741이다)에서는 격자를 뺀다 — 자르면 반쯤 잘린 지도가 되고, 그건 자랑하려던
   * 사람에게 가장 나쁜 결과다. 링크를 펼치면 카드에 지도가 있다.
   */
  const postToX = () => {
    mark();
    const lean = { ...body, grid: null };
    const full = shareText(body);
    window.open(
      tweetUrl(fitsTweet(full) ? full : shareText(lean), challengeUrl()),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    /*
     * 큰 단추 하나가 아니라 카드 하나에 모은 **평평한 선택지들**이다.
     *
     * 어디로 보낼지는 사람마다 다르다. `결과 보내기` 하나를 크게 두었더니 그것이
     * 무슨 일을 하는지가 기기마다 달랐고(모바일은 공유 시트, 데스크톱은 복사)
     * 나머지 길은 곁다리로 보였다. 같은 무게로 늘어놓고 고르게 한다.
     *
     * 모달로 띄우는 사이트가 많지만 여기서는 카드로 충분하다. 결과 화면은
     * 이미 세로로 흐르는 판이고, 한 겹을 더 얹을 만큼 고를 것이 많지 않다.
     */
    <div className="flex flex-col gap-2 rounded-xl border border-concrete-deep bg-paint/60 p-3">
      {/*
        보낼 것을 보여 준다.
        여태 이 자리에는 단추만 있었고, 누르기 전에는 무엇이 나가는지 볼 방법이
        없었다. 이 게임의 공유물은 링크가 아니라 **이 그림**이다 — 주인공이
        카카오톡이나 X가 아니라 자기 판이어야 한다.

        코스명과 기록은 안 적는다. 바로 위 표지판이 이미 그 말을 하고 있다.
      */}
      {grid && (
        <pre
          aria-hidden
          className="overflow-hidden text-center text-[10px] leading-[1.15] break-keep whitespace-pre sm:text-xs"
        >
          {renderGrid(grid, results)}
        </pre>
      )}

      <div className="flex items-stretch">
        {/*
          기기 공유 시트. 이 API가 없는 데스크톱에서는 칸 자체를 안 낸다 —
          있지도 않은 길을 그려 두면 눌러 본 사람만 손해다.
        */}
        {canShare && (
          <ShareOption label="공유" onClick={share}>
            {/* 어느 앱으로 갈지 모르는 자리라 브랜드가 없다. 일반 공유 기호를 쓴다. */}
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="18" cy="5" r="2.6" />
              <circle cx="6" cy="12" r="2.6" />
              <circle cx="18" cy="19" r="2.6" />
              <path d="M8.4 10.8 15.6 6.9M8.4 13.2l7.2 3.9" />
            </svg>
          </ShareOption>
        )}

        {KAKAO_KEY && (
          <ShareOption label="카카오톡" onClick={kakao}>
            <BrandMark d={BRAND_PATH.kakaotalk} className="size-5 text-[#191600]" />
          </ShareOption>
        )}

        {/*
          X는 공유 시트가 없는 곳에만 낸다.
          시트가 있으면 거기 이미 X가 뜨고, 게다가 시트에는 그 사람이 실제로
          쓰는 앱들(메시지·디스코드·텔레그램)이 함께 나온다. 우리가 고른 두어
          개를 늘어놓는 것보다 그쪽이 넓고 정확하다.
        */}
        {!canShare && (
          <ShareOption label="X" onClick={postToX}>
            <BrandMark d={BRAND_PATH.x} className="size-4 text-ink" />
          </ShareOption>
        )}

        {/*
          링크만 보내고 싶은 사람이 있다. 격자까지 붙으면 길어서 트위터 답글이나
          디스코드 한 줄에는 안 맞는다.
        */}
        <ShareOption label="링크 복사" onClick={() => { mark(); void copy(challengeUrl()); }}>
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.3 1.3" />
            <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.3-1.3" />
          </svg>
        </ShareOption>
      </div>

      {/* 복사는 아무 화면 변화가 없다. 눌린 것을 알려 주지 않으면 다시 누른다. */}
      <p className="text-center font-mono text-xs text-dim" role="status" aria-live="polite">
        {copied ? "복사했습니다 — 붙여 넣어 보내세요" : "\u00a0"}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { BrandMark, ShareOption } from "./ShareOption";
import { BRAND_PATH } from "./brandPaths";
import { KAKAO_KEY, sendKakao } from "@/lib/share/kakao";
import { tweetUrl } from "@/lib/share/x";

/**
 * 어디로 보낼지 고르는 카드.
 *
 * **무엇을 보낼지는 부르는 쪽이 정하고, 어떻게 보낼지는 여기가 안다.** 판이
 * 끝난 결과와 오늘의 퀴즈가 보내는 물건은 다르지만 보내는 길은 같다 — 공유
 * 시트, 카카오 카드, X 작성창, 클립보드. 그 길을 두 곳에 각각 적어 두면 한쪽만
 * 고쳐지는 날이 온다.
 *
 * 큰 단추 하나가 아니라 **평평한 선택지들**이다. 어디로 보낼지는 사람마다 다르고,
 * 하나를 크게 두면 나머지가 곁다리로 보인다.
 */
export interface ShareCardProps {
  /** 붙여넣을 덩어리. 링크는 빼고 준다 — 뒤에 붙이는 것은 여기가 한다. */
  text: string;
  /** 공유할 주소. 상대 경로로 준다(`window`를 렌더 중에 못 읽는다). */
  path: string;
  /** 링크에만 붙는 꼬리표. 본문에는 안 들어간다. */
  query?: string;
  /** 격자 미리보기. 없으면 안 그린다. */
  preview?: ReactNode;
  /**
   * 카카오 카드에 실을 말. 없으면 카카오톡 칸을 안 낸다.
   *
   * 시트로 카톡에 보내면 그냥 텍스트라 미리보기가 일반 소개 카드가 되고,
   * SDK로 보내야 제목에 기록이 박힌다 — 보내는 물건이 다르다.
   */
  kakao?: { title: string; description: string } | null;
  /**
   * 시트에 함께 넘길 그림. 상대 경로로 준다. 없으면 글만 보낸다.
   *
   * **미리 받아 둔다.** 사파리는 `navigator.share`를 사용자 제스처 안에서
   * 부르라고 요구한다. 누른 뒤에 받아 오면 그 사이에 활성화 창이 지나 거부된다.
   */
  imagePath?: string | null;
  /** X 작성창에 넣을 글. 없으면 X 칸을 안 낸다(280자에 못 맞추는 경우). */
  tweet?: string | null;
  /** 어느 길로든 보내려 할 때 한 번. 분석용이다. */
  onShare?: () => void;
}

export function ShareCard({
  text,
  path,
  query,
  preview,
  kakao = null,
  imagePath = null,
  tweet = null,
  onShare,
}: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  /*
   * 공유 시트가 있는 기기인가. 서버는 모르는 값이라 하이드레이션 뒤에 본다 —
   * 렌더 중에 navigator를 읽으면 서버가 그린 것과 어긋난다.
   */
  const hydrated = useIsHydrated();
  const canShare = hydrated && typeof navigator.share === "function";

  const linkOf = () =>
    `${window.location.origin}${path}${query ? `?${query}` : ""}`;
  /*
   * 붙여 넣을 한 덩이 — 본문과 링크.
   *
   * 한동안 링크만 복사했다. 결과 화면에서는 그래도 됐다. 거기서는 **링크가
   * 곧 기록**이라(`/c/map/seoul/41080~JAZg/승원`) 받는 쪽에서 카드가 펼쳐지며
   * 숫자가 나온다. 오늘의 퀴즈는 주소가 `/today` 하나뿐이라 그 규칙이 안
   * 통했다 — 자랑하려고 누른 사람이 아무것도 안 담긴 주소를 얻는다.
   *
   * 그래서 두 화면 다 본문을 함께 싣는다. 링크가 기록을 지고 있는 쪽에서도
   * 손해가 없다. 카드를 안 펼치는 앱에서는 오히려 이쪽만 읽힌다.
   */
  const payload = () => `${text}\n${linkOf()}`;

  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (!canShare || !imagePath || typeof navigator.canShare !== "function") return;
    let alive = true;
    void fetch(imagePath)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!alive || !blob) return;
        const made = new File([blob], "sigun-typing.png", { type: "image/png" });
        if (navigator.canShare({ files: [made] })) setFile(made);
      })
      .catch(() => {
        // 망이 끊겼거나 서버가 늦다. 글만 보낸다.
      });
    return () => {
      alive = false;
    };
  }, [canShare, imagePath]);

  const copy = async (body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드가 막힌 환경. 주소창에서 직접 복사하는 수밖에 없다.
    }
  };

  const share = async () => {
    onShare?.();
    const payload = { title: "시군 타이핑", text, url: linkOf() };
    try {
      await navigator.share(file ? { ...payload, files: [file] } : payload);
    } catch {
      // 공유창을 닫은 것이다. 복사로 떨어뜨릴 이유는 없다.
    }
  };

  const toKakao = async () => {
    if (!kakao) return;
    onShare?.();
    const ok = await sendKakao({
      ...kakao,
      url: linkOf(),
      imageUrl: `${window.location.origin}/og.png`,
    });
    // 도메인 미등록이나 SDK 실패. 조용히 붙여 넣을 수 있게 떨어뜨린다.
    if (!ok) await copy(payload());
  };

  const toX = () => {
    if (!tweet) return;
    onShare?.();
    window.open(tweetUrl(tweet, linkOf()), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-concrete-deep bg-paint/60 p-3">
      {preview}

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

        {KAKAO_KEY && kakao && (
          <ShareOption label="카카오톡" onClick={toKakao}>
            <BrandMark d={BRAND_PATH.kakaotalk} className="size-5 text-[#191600]" />
          </ShareOption>
        )}

        {/*
          X는 공유 시트가 없는 곳에만 낸다.
          시트가 있으면 거기 이미 X가 뜨고, 게다가 그 사람이 실제로 쓰는 앱들
          (메시지·디스코드·텔레그램)이 함께 나온다.
        */}
        {!canShare && tweet && (
          <ShareOption label="X" onClick={toX}>
            <BrandMark d={BRAND_PATH.x} className="size-4 text-ink" />
          </ShareOption>
        )}

        <ShareOption
          label="복사"
          onClick={() => {
            onShare?.();
            void copy(payload());
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden
          >
            <rect x="9" y="3" width="6" height="3.2" rx="1" />
            <path d="M9 4.6H7.2A1.2 1.2 0 0 0 6 5.8v13a1.2 1.2 0 0 0 1.2 1.2h9.6a1.2 1.2 0 0 0 1.2-1.2v-13a1.2 1.2 0 0 0-1.2-1.2H15" />
            <path d="M9 11h6M9 14.5h6M9 18h3.5" />
          </svg>
        </ShareOption>
      </div>

      {/* 복사는 아무 화면 변화가 없다. 눌린 것을 알려 주지 않으면 다시 누른다. */}
      <p className="text-center font-mono text-xs text-dim" role="status" aria-live="polite">
        {copied ? "복사했습니다 — 붙여 넣어 보내세요" : " "}
      </p>
    </div>
  );
}

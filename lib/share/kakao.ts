"use client";

/**
 * 카카오톡으로 결과 카드 보내기.
 *
 * 채팅방에 주소만 붙으면 미리보기 카드가 스크래핑된 OG 태그로 그려진다. 그
 * 카드는 어떤 기록을 공유하든 똑같이 "시군 타이핑 소개"라고 말한다 — 도전장을
 * 보냈는데 카드는 아무 말도 안 하는 셈이다. 카카오 SDK로 보내면 카드를 직접
 * 짜므로 제목에 기록이 박힌다.
 *
 * ── 격자는 이 카드에 못 들어간다 ────────────────────────────
 * 피드 카드의 설명은 두 줄쯤에서 잘린다. 다섯 줄짜리 격자를 넣으면 잘린 채로
 * 뜬다. 그래서 격자를 보내는 길(공유 시트·복사)과 카드를 보내는 길을 나란히
 * 둔다 — 둘은 보내는 물건이 다르다. 격자는 내 판이고 카드는 초대장이다.
 *
 * ── 키에 대하여 ────────────────────────────────────────────
 * JavaScript 키는 브라우저에 드러나는 것이 정상이다. 접근을 막는 것은 키가
 * 아니라 카카오 콘솔에 등록한 도메인이라, 남이 키를 베껴도 자기 사이트에서는
 * 안 돈다. 그래서 NEXT_PUBLIC_로 둔다.
 */

interface KakaoShare {
  sendDefault(settings: Record<string, unknown>): void;
}

interface KakaoSdk {
  init(key: string): void;
  isInitialized(): boolean;
  Share: KakaoShare;
}

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

const SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
/*
 * 남의 CDN에서 스크립트를 실행하는 값이다. 지금 그 주소가 주는 파일의 해시를
 * 박아 두면, 내용이 바뀐 순간 브라우저가 실행을 거부한다.
 *
 *   curl -s https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js |
 *     openssl dgst -sha384 -binary | openssl base64 -A
 *
 * 버전을 올릴 때 이 값도 함께 다시 뽑아야 한다. 안 그러면 단추가 조용히
 * 안 먹는다 — sendKakao가 false를 돌려주고 공유가 원래 길로 떨어진다.
 */
const SDK_INTEGRITY =
  "sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka";

export const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";

let loading: Promise<KakaoSdk | null> | null = null;

/**
 * SDK를 **누를 때** 불러온다.
 *
 * 판 화면을 여는 모든 사람에게 남의 스크립트를 미리 받게 할 이유가 없다. 결과를
 * 보고 공유를 누르는 사람만 이 길로 온다.
 */
function loadSdk(): Promise<KakaoSdk | null> {
  if (!KAKAO_KEY) return Promise.resolve(null);
  if (window.Kakao?.isInitialized()) return Promise.resolve(window.Kakao);
  loading ??= new Promise<KakaoSdk | null>((resolve) => {
    const el = document.createElement("script");
    el.src = SDK_SRC;
    el.integrity = SDK_INTEGRITY;
    el.crossOrigin = "anonymous";
    el.async = true;
    el.onload = () => {
      const sdk = window.Kakao;
      if (!sdk) return resolve(null);
      if (!sdk.isInitialized()) sdk.init(KAKAO_KEY);
      resolve(sdk);
    };
    // 차단기나 망 문제로 못 받을 수 있다. 그때는 부르는 쪽이 다른 길로 간다.
    el.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(el);
  });
  return loading;
}

export interface KakaoCard {
  /** 카드 제목. 여기 기록이 박힌다. */
  title: string;
  /** 제목 아래 한 줄. 두 줄이 넘으면 잘린다. */
  description: string;
  /** 눌렀을 때 갈 곳. 기록이 실린 도전장 주소다. */
  url: string;
  imageUrl: string;
}

/**
 * 보냈으면 true.
 *
 * false면 부르는 쪽이 원래 길(공유 시트·복사)로 떨어져야 한다. 키가 없거나,
 * SDK를 못 받았거나, 도메인이 콘솔에 등록되지 않은 경우가 여기로 온다.
 */
export async function sendKakao(card: KakaoCard): Promise<boolean> {
  const sdk = await loadSdk();
  if (!sdk) return false;
  try {
    sdk.Share.sendDefault({
      objectType: "feed",
      content: {
        title: card.title,
        description: card.description,
        imageUrl: card.imageUrl,
        link: { mobileWebUrl: card.url, webUrl: card.url },
      },
      buttons: [
        {
          title: "같이 한 판",
          link: { mobileWebUrl: card.url, webUrl: card.url },
        },
      ],
    });
    return true;
  } catch {
    // 도메인 미등록이 대부분이다. 조용히 다른 길로 보낸다.
    return false;
  }
}

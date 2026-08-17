import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";

/**
 * 폰트는 자체 호스팅한다. 구글 폰트 CDN에 런타임 의존성을 만들지 않고,
 * 한글 서브셋이 뒤늦게 로드되며 지명이 튀는 일도 막기 위해서다.
 *
 * 본문·표지판: Pretendard — 한글 자소 균형이 가장 안정적이다.
 * 숫자: IBM Plex Mono — 타수·정확도·시간은 계기판처럼 고정폭으로 읽혀야 한다.
 */
const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--font-plex-kr",
  weight: "45 920",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "../public/fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

/*
 * 설명문에는 **사람들이 실제로 검색창에 치는 말**이 들어가야 한다.
 *
 * 이 게임을 가장 정확히 묘사하는 단어는 "지명"과 "행정구역"이지만, 아무도
 * 그렇게 검색하지 않는다. 비슷한 게임의 유입 검색어 절반 이상이 "타자 연습",
 * "타이핑 연습", "타자 게임" 쪽이다 — 게임 이름을 아는 사람이 아니라 타자
 * 연습할 것을 찾다가 흘러든 사람들이다. 그 말을 한 번은 적어 둔다.
 *
 * 공유 카드에도 이 문장이 그대로 뜨므로, 검색어를 나열하지 않고 문장으로 둔다.
 */
const DESCRIPTION =
  "지도에 표시된 지역이 어디인지 떠올려 이름을 입력하는 지도 게임. 시군구 지명을 외우면서 하는 타자 연습입니다. 맞힐 때마다 대한민국 지도가 하나씩 채워집니다.";

export const metadata: Metadata = {
  /*
   * 공유 카드.
   *
   * 미리보기가 없는 링크는 주소 문자열 하나로 지나간다. 이미지는 빌드 때
   * 미리 떠 둔 한 장이고(`npm run build:og`), 카드에 뜨는 제목·설명은
   * 아래 값이 그대로 쓰인다 — 그래서 이미지 안에 같은 문구를 또 넣지 않는다.
   *
   * metadataBase가 있어야 상대 경로가 절대 주소로 바뀐다. 크롤러는 상대
   * 경로를 못 읽으므로, 이게 빠지면 이미지가 통째로 무시된다.
   */
  metadataBase: new URL(siteUrl()),
  /*
   * "시군 타이핑"은 행정 용어라 아무도 검색창에 치지 않는 말이다. 이름만으로는
   * 브랜드를 아는 사람 외에 아무도 닿지 못하므로, 첫 화면 제목에는 이게 무엇인지
   * 한 줄을 붙인다.
   *
   * template 덕분에 하위 페이지는 제 이름만 적으면 된다 — 전에는 페이지마다
   * "— 시군 타이핑"을 손으로 붙이고 있었고, 코스 목록만 그게 빠져 있었다.
   * 공유 카드 제목(openGraph)은 짧은 이름 그대로 둔다. 그건 링크를 이미 받은
   * 사람이 보는 자리라 설명이 필요 없다.
   *
   * `대한민국`이 붙어 있는 이유. 사람들은 `대한민국 지명 타이핑`처럼 나라
   * 이름을 앞에 놓고 찾는다 — 세계 지도를 치는 것도, 지하철 노선도를 치는
   * 것도 있으니 어느 지도인지가 먼저다. 설명문에는 있었지만 제목에는 없었다.
   * 한 줄에 다 넣어도 문장이 부러지지 않아 자리를 옮기지 않고 끼웠다.
   */
  title: {
    default: "시군 타이핑 — 지도로 하는 대한민국 지명 타자 연습",
    template: "%s — 시군 타이핑",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "시군 타이핑",
    locale: "ko_KR",
    title: "시군 타이핑",
    description: DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "대한민국 지도에서 한 곳이 노랗게 표시되고, 도로표지판 모양의 입력판에 이름을 치는 중인 화면",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

/**
 * 브라우저 UI 색은 **미디어 없는 태그 하나**로 둔다.
 *
 * `light`/`dark` 두 개를 미디어로 나눠 붙이는 방법이 흔하지만, 그러면 시스템이
 * 어두운데 밝게 쓰겠다고 고른 사람에게 주소창만 검게 남는다 — 미디어로 갈린
 * 태그는 사용자의 선택을 따라올 수 없다. 태그는 하나만 두고 THEME_SCRIPT와
 * setThemeChoice가 그 content를 고쳐 쓴다.
 *
 * viewportFit은 아래쪽 탭 바가 iOS 홈 인디케이터 밑까지 깔리기 위한 전제다.
 * 이게 없으면 env(safe-area-inset-*)가 전부 0이다.
 */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#dee0db",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
     * suppressHydrationWarning은 <html>에만 붙는다.
     *
     * 아래 스크립트가 React보다 먼저 이 노드에 data-theme을 붙이므로 서버가
     * 보낸 HTML과 실제 DOM이 달라지고, React는 그것을 불일치로 신고한다.
     * 이 속성은 한 단계에만 적용되므로 body 아래의 진짜 불일치는 그대로 잡힌다.
     */
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${pretendard.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* 파서를 막고 도는 자리. 여기서 붙여야 첫 페인트가 이미 고른 판이다. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-concrete text-ink flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}

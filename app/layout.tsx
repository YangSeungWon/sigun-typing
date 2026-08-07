import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { siteUrl } from "@/lib/site";

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

const DESCRIPTION =
  "지도에 표시된 지역이 어디인지 떠올려 이름을 입력하는 게임. 맞힐 때마다 대한민국 지도가 하나씩 채워집니다.";

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
  title: "시군 타이핑",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="bg-concrete text-ink flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}

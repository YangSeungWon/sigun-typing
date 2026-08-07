import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "시군 타이핑",
    short_name: "시군 타이핑",
    description:
      "대한민국 지명을 타이핑하며 지도를 채우는 게임. 익숙해지면 지도만 보고 도전할 수 있습니다.",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    // 도로표지판 녹색과 콘크리트 회색. 앱으로 띄웠을 때도 같은 인상이어야 한다.
    background_color: "#dee0db",
    theme_color: "#0a6b3d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

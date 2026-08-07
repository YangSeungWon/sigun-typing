import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 컨테이너 이미지를 가볍게 하려고 필요한 것만 담은 서버를 뽑는다.
  output: "standalone",
};

export default nextConfig;

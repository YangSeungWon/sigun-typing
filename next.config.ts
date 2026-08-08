import type { NextConfig } from "next";

/**
 * 모드 주소를 바꾸면서 남긴 길.
 *
 * 사람에게 보이는 이름을 바꿨으면 주소도 같은 말을 써야 한다 —
 * `퀴즈`라는 말을 화면에서 다 걷어냈는데 주소만 `/play/quiz/`로 남으면
 * 그게 마지막 잔재가 된다.
 *
 * 다만 옛 주소가 죽으면 이미 나간 링크와 검색 결과가 404가 된다. 영구 이동으로
 * 넘겨 두면 그 링크들이 계속 살아 있고, 검색엔진도 새 주소로 옮겨 간다.
 * 몇 줄로 끝나는 일이라 미룰 이유가 없다.
 */
const MODE_MOVES: [from: string, to: string][] = [
  ["quiz", "map"],
  ["single", "learn"],
  ["memorize", "test"],
];

const nextConfig: NextConfig = {
  // 컨테이너 이미지를 가볍게 하려고 필요한 것만 담은 서버를 뽑는다.
  output: "standalone",

  async redirects() {
    return MODE_MOVES.flatMap(([from, to]) => [
      { source: `/play/${from}`, destination: `/play/${to}`, permanent: true },
      {
        source: `/play/${from}/:course`,
        destination: `/play/${to}/:course`,
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;

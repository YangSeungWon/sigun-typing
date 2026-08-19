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

  /**
   * 배포 판번호.
   *
   * 배포하는 동안 열려 있던 탭은 **옛 자바스크립트를 들고 새 서버에 말을 건다.**
   * 서버가 내려보내는 값의 모양이 바뀌면 그 탭은 그 자리에서 깨진다 — 첫 화면에서
   * `오늘의 도전`을 걷어냈을 때 실제로 그랬다(`e.today is undefined`).
   *
   * 이 값이 있으면 Next가 응답에 배포 판번호를 실어 보내고, 클라이언트는 자기
   * 것과 다르면 화면 안에서 넘어가는 대신 **통째로 새로고침한다.** 낡은 코드가
   * 새 값을 만나는 일 자체가 없어진다.
   *
   * 값은 배포 때 넘기는 git 해시를 그대로 쓴다(docker-compose.yml).
   * 개발 중에는 비어 있고, 그때는 이 장치가 필요 없다.
   */
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,

  /**
   * 도전장 카드가 읽는 폰트를 standalone 산출물에 함께 담는다.
   *
   * `output: "standalone"`은 코드에서 import한 것만 따라간다. 폰트는 실행
   * 중에 `readFile`로 여는 파일이라 그 추적에 안 걸리고, 빠지면 카드가
   * 그려지는 순간 터진다 — 개발에서는 저장소가 통째로 있어 안 드러난다.
   */
  outputFileTracingIncludes: {
    "/c/[mode]/[course]/[beat]": ["./assets/**"],
    "/c/[mode]/[course]/[beat]/[by]": ["./assets/**"],
  },

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

import { MultiRoom } from "@/components/MultiRoom";

export const metadata = {
  title: "친구와 대결",
  description: "방을 만들고 코드를 알려 주면 최대 8명이 같은 코스를 함께 달립니다.",
  /*
   * 초대 링크 전용 카드.
   *
   * 이 주소는 대개 단톡방에 붙는다. 루트 카드를 그대로 물려받으면 "시군
   * 타이핑은 이런 게임입니다" 소개가 떠서, 방에 들어오라는 말이 사이트
   * 홍보로 읽힌다.
   *
   * 방마다 다른 카드는 만들지 않는다. 방 상태는 소켓 서버 메모리에만 있어
   * 조회 경로를 새로 열어야 하고, `3명 대기 중` 같은 값은 카카오톡이 카드를
   * 캐시하는 순간 굳어 금세 거짓말이 된다 — 방은 몇 분짜리 물건이라 카드와
   * 수명이 안 맞는다. 지금 몇 명인지는 링크를 누르면 바로 보인다.
   */
  openGraph: {
    title: "친구와 대결",
    description: "같은 코스를 최대 8명이 동시에 달립니다.",
    url: "/rooms",
    images: [
      {
        url: "/og-rooms.png",
        width: 1200,
        height: 630,
        alt: "네 사람의 진행 막대가 서로 다른 데까지 차 있는 순위표",
      },
    ],
  },
};

export default async function RoomsPage({ searchParams }: PageProps<"/rooms">) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : undefined;

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-6 py-14">
      <MultiRoom initialCode={code} />
    </main>
  );
}

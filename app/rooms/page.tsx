import { MultiRoom } from "@/components/MultiRoom";

export const metadata = {
  title: "친구와 대결 — 시군 타이핑",
  description: "방을 만들고 코드를 알려 주면 최대 8명이 같은 코스를 함께 달립니다.",
};

export default async function RoomsPage({ searchParams }: PageProps<"/rooms">) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : undefined;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-6 py-14">
      <MultiRoom initialCode={code} />
    </main>
  );
}

import { BackLink } from "@/components/BackLink";
import { MistakeNotes } from "@/components/MistakeNotes";

export const metadata = {
  title: "헷갈리는 지역",
  description: "자주 틀린 지역을 모아 그것만 다시 풉니다.",
};

export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <BackLink href="/">시군 타이핑</BackLink>
        {/*
          "오답노트"는 학교 시험의 말이고, 규칙(2번 연속 정답)은 시스템의 말이다.
          사용자에게 필요한 것은 자기 상태뿐이다 — 어디가 아직 헷갈리는가.
        */}
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          헷갈리는 지역
        </h1>
        <p className="text-dim">기록은 이 기기에만 남습니다.</p>
      </header>

      <MistakeNotes />
    </main>
  );
}

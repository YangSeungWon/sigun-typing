import Link from "next/link";
import { MistakeNotes } from "@/components/MistakeNotes";

export const metadata = {
  title: "오답노트 — 시군 타이핑",
  description: "자주 틀린 지역을 모아 그것만 다시 풉니다.",
};

export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="font-mono text-sm tracking-[0.12em] text-dim uppercase transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          ← 시군 타이핑
        </Link>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">오답노트</h1>
        <p className="text-dim">
          틀리거나 힌트를 본 지역이 모입니다. 두 번 연속으로 깨끗하게 맞히면
          목록에서 빠집니다. 기록은 이 기기에만 남습니다.
        </p>
      </header>

      <MistakeNotes />
    </main>
  );
}

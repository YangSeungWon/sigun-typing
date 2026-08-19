import Link from "next/link";
import { MistakeNotes } from "@/components/MistakeNotes";

export const metadata = {
  title: "헷갈리는 지역",
  description: "자주 틀린 지역을 모아 그것만 다시 풉니다.",
};

export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        {/*
          "오답노트"는 학교 시험의 말이고, 규칙(2번 연속 정답)은 시스템의 말이다.
          사용자에게 필요한 것은 자기 상태뿐이다 — 어디가 아직 헷갈리는가.
        */}
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          헷갈리는 지역
        </h1>
        {/*
          랭킹으로 가는 문이 여기다. 아래 탭 바는 넷으로 고정이고 좁은 화면에는
          헤더 링크가 없어서, 이 줄이 없으면 랭킹은 주소를 아는 사람만 가는
          화면이 된다. 메뉴를 하나 더 다는 대신 이미 있는 문장을 쓴다 — 이 줄이
          하는 말이 "이 기록은 여기 뿐"이고, 거기서 이어지는 물음이 "그럼
          남들과 겨루는 건 어디서"다.
        */}
        <p className="text-dim">
          기록은 이 기기에만 남습니다. 서버에 오른 기록은{" "}
          {/*
            링크와 조사는 한 덩어리다. 좁은 화면에서 `랭킹`과 `에 있습니다.`가
            갈라지면 조사만 다음 줄에 홀로 남아 읽다가 걸린다.
          */}
          <span className="whitespace-nowrap">
            <Link
              href="/ranking"
              className="underline decoration-concrete-deep underline-offset-4 transition-colors hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              랭킹
            </Link>
            에 있습니다.
          </span>
        </p>
      </header>

      <MistakeNotes />
    </main>
  );
}

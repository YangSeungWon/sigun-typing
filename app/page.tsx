import Link from "next/link";
import { COURSES, getCourse } from "@/data/courses";
import { HomeView } from "@/components/HomeView";
import { MODE_HINTS, MODE_LABELS } from "@/lib/game/modes";
import { keystrokeCount } from "@/lib/hangul/keystrokes";

/**
 * 첫 방문자가 5초 안에 이해해야 하는 것 —
 * **지도에 표시된 지역이 어디인지 떠올려 이름을 친다.**
 *
 * 한때 따라치기를 입구로 뒀다가 되돌렸다. 회상 부담을 낮추려던 것인데,
 * 답이 적힌 채로 지도가 그 지역을 가리키니 무엇을 맞히는 게임인지
 * 알 수 없었다. 부담은 본편 안에서 낮춘다 —
 * 쉬운 첫 코스(전국 17 시도)와 초성 힌트로.
 *
 * 서울·경기·강원·부산은 대부분 안다. 그래서 첫 판의 감상이
 * "못 하겠다"가 아니라 "생각보다 아는데?"가 된다.
 */
const ENTRY_COURSE = "sido";

/** 홈에 직접 노출할 코스. 이름이 익숙한 것부터. 나머지는 코스 목록에서 고른다. */
const FEATURED = ["sido", "seoul", "gyeonggi", "busan"];

export default function Home() {
  const entry = getCourse(ENTRY_COURSE)!;
  const featured = FEATURED.map((id) => getCourse(id)).filter((c) => c !== undefined);
  const placeCount = COURSES.reduce((n, c) => n + c.regions.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-14 px-6 py-14">
      <HomeView />

      <header className="flex flex-col gap-4">
        <span className="font-mono text-sm tracking-[0.28em] text-dim uppercase">
          전국 도시 · 시 · 군 · 구
        </span>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          시군 타이핑
        </h1>
        <p className="max-w-md text-lg text-dim">
          지도에 표시된 지역이 어디인지 떠올려 이름을 직접 입력하세요.
          맞힐 때마다 대한민국 지도가 하나씩 채워집니다.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <Link
          href={`/play/quiz/${entry.id}?from=home_primary`}
          className="sign-face flex flex-col gap-2 rounded-xl px-8 py-7 shadow-[0_8px_0_0_var(--color-sign-deep)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="font-mono text-sm tracking-[0.22em] text-paint/70 uppercase">
            처음이라면
          </span>
          <span className="text-2xl font-bold text-paint sm:text-3xl">
            {entry.name}
          </span>
          <span className="text-base text-paint/75">
            지도에 표시된 지역의 이름을 입력하세요
          </span>
          <span className="font-mono text-sm text-paint/60">
            {entry.regions.length}곳 ·{" "}
            {entry.regions.reduce((n, r) => n + keystrokeCount(r.name), 0)}타 · 초성 힌트
            사용 가능
          </span>
        </Link>

        <Link
          href={`/play/single/${entry.id}?from=home_secondary`}
          className="flex items-baseline justify-between gap-4 rounded-xl border border-concrete-deep px-6 py-4 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="font-medium">처음이라 어렵다면?</span>
          <span className="text-base text-dim">이름 보고 연습하기 →</span>
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-sm tracking-[0.18em] text-dim uppercase">
            지역 챌린지
          </h2>
          <Link
            href="/play/quiz"
            className="font-mono text-sm text-dim transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            전체 {COURSES.length}개 코스 →
          </Link>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {featured.map((course) => (
            <li key={course.id}>
              <Link
                href={`/play/quiz/${course.id}?from=home_challenge`}
                className="flex flex-col gap-1 rounded-xl border border-concrete-deep bg-paint/60 px-5 py-4 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span className="font-semibold">{course.name}</span>
                <span className="font-mono text-sm tabular-nums text-dim">
                  {course.regions.length}개 {course.placeUnit}
                </span>
              </Link>
              {/* 목록부터 보고 싶은 사람도 있다. 바로 게임에 넣는 것만이 답은 아니다. */}
              <Link
                href={`/courses/${course.id}`}
                className="mt-1 inline-block font-mono text-xs text-dim transition-colors hover:text-ink"
              >
                {course.name} 목록 보기 →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/*
        멀티는 "다른 게임" 목록에 묻혀 있었다. 설명하기 가장 쉬운 것이
        "친구 여덟이서 누가 제일 빠른가"인데, 그게 한 줄짜리 항목으로
        내려가 있으면 아무도 발견하지 못한다.
      */}
      <section className="flex flex-col gap-3">
        <Link
          href="/rooms"
          className="flex flex-col gap-1 rounded-xl border border-sign bg-sign/10 px-6 py-5 transition-colors hover:bg-sign/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="text-xl font-semibold">친구와 대결</span>
          <span className="text-base text-dim">
            초대 링크를 보내면 최대 여덟 명이 같은 지도를 놓고 동시에 답합니다
          </span>
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-sm tracking-[0.18em] text-dim uppercase">
          다른 게임
        </h2>
        <ul className="flex flex-col gap-2">
          {(["timeattack", "single", "memorize"] as const).map((mode) => (
            <li key={mode}>
              <Link
                href={`/play/${mode}`}
                className="flex items-baseline justify-between gap-4 rounded-lg border border-concrete-deep px-5 py-3 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span className="font-medium">{MODE_LABELS[mode]}</span>
                <span className="text-right text-base text-dim">{MODE_HINTS[mode]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="flex gap-4 font-mono text-sm text-dim" aria-label="내 기록">
        <Link href="/guide" className="transition-colors hover:text-ink">
          이용안내
        </Link>
        <Link href="/notes" className="transition-colors hover:text-ink">
          오답노트
        </Link>
        <Link href="/ranking" className="transition-colors hover:text-ink">
          랭킹
        </Link>
      </nav>

      <footer className="mt-auto flex flex-col gap-2 border-t border-concrete-deep pt-6 font-mono text-xs text-dim">
        <span>
          코스 {COURSES.length}개 · 지역 {placeCount}곳 · 통계청 SGIS 행정구역경계
          (2025)
        </span>
        <span>
          2025년 행정구역 기준입니다. 이후 개편된 지역은 아직 반영되어 있지 않습니다.
        </span>
        <span className="flex gap-4 pt-1">
          <Link href="/privacy" className="transition-colors hover:text-ink">
            개인정보 처리방침
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink">
            이용약관
          </Link>
        </span>
      </footer>
    </main>
  );
}

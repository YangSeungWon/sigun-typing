import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { DongHistory, type DongStory } from "@/components/DongHistory";
import stories from "@/data/timelapse/dong-history.json";

const STORIES = stories as Record<string, DongStory>;

export function generateStaticParams() {
  return Object.keys(STORIES).map((course) => ({ course }));
}

/**
 * 한 동네의 읍면동 변천.
 *
 * `/history`는 전국 연표다. 시도가 늘고 시군구가 합쳐진 이야기라 온 나라가
 * 함께 겪은 일이고, 거기 성북구 동 통폐합을 올리면 성격이 다른 목록이 된다.
 *
 * 그런데 **거기 살았던 사람에게는 그게 더 큰 사건**이다. 그래서 변천사 아래
 * 층으로 두고, 그 구의 코스에서 들어온다. 목록에는 세우지 않는다 — 자기
 * 동네를 아는 사람만 찾을 물건이라 늘어놓을 이유가 없다.
 */
export default async function DongHistoryPage({
  params,
}: PageProps<"/history/dong/[course]">) {
  const { course } = await params;
  const story = STORIES[course];
  if (!story) notFound();

  const first = story.states[0];
  const last = story.states[story.states.length - 1];

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 pt-8 pb-14">
      <BackLink href={`/courses/${course}`}>{story.name}</BackLink>

      {/* 개수의 변화가 이 화면의 제목이다. */}
      <header className="flex items-end justify-between gap-5">
        <h1 className="shrink-0 font-mono text-5xl leading-none font-bold tabular-nums sm:text-6xl">
          {first.regions.length}
          <span className="text-dim"> → </span>
          {last.regions.length}
        </h1>
        <div className="flex flex-col items-end gap-1">
          <p className="text-right text-lg leading-snug font-medium break-keep">
            {story.parent}의 동이 {first.year}년 {first.regions.length}곳에서{" "}
            {last.year}년 {last.regions.length}곳으로
          </p>
          {/*
            여기 적힌 해는 **자료의 해**다. 시행일이 아니다.
            경계 자료는 해마다 한 번 찍히므로 그 사이에 일어난 일이 다음 해
            판에 나타난다. 아는 척하느니 어디까지 아는지를 적는다.
          */}
          <p className="font-mono text-xs tabular-nums text-dim">자료에 나타난 해</p>
        </div>
      </header>

      <DongHistory story={story} />

      <nav className="border-t border-edge pt-4 text-base">
        <Link href="/history" className="text-dim hover:text-ink">
          ← 전국 변천사
        </Link>
      </nav>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<"/history/dong/[course]">) {
  const { course } = await params;
  const story = STORIES[course];
  if (!story) return {};

  const first = story.states[0];
  const last = story.states[story.states.length - 1];
  return {
    title: `${story.parent} 동 변천 — ${first.year}년 ${first.regions.length}곳에서 ${last.year}년 ${last.regions.length}곳으로`,
    description: `${story.parent}의 읍면동이 어떻게 나뉘고 합쳐졌는지 지도로 봅니다.`,
    alternates: { canonical: `/history/dong/${course}` },
  };
}

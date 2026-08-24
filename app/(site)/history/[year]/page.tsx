import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { EventMaps, type HistoryEvent } from "@/components/EventMaps";
import data from "@/data/timelapse/events.json";

const EVENTS = data.events as HistoryEvent[];
const find = (year: string) => EVENTS.find((e) => e.year === year);

export function generateStaticParams() {
  return EVENTS.map((e) => ({ year: e.year }));
}

/**
 * 개편 한 건.
 *
 * `/history`의 타임랩스는 전국 시도만 다룬다. 시군구 개편은 그 축척에서
 * 몇 픽셀이라, 창원 통합도 청주 통합도 거기서는 아무 일도 아닌 것처럼 보인다.
 * 여기서는 그 일이 일어난 시도만 잘라 전후를 나란히 놓는다.
 *
 * 검색으로 들어오는 길이 게임 쪽과 아주 다르다 — `창원 통합`, `군위군 대구
 * 편입`은 실제로 찾는 말이고, 그 사람에게 보여 줄 것이 여기 있다.
 */
export default async function EventPage({ params }: PageProps<"/history/[year]">) {
  const { year } = await params;
  const event = find(year);
  if (!event) notFound();

  const i = EVENTS.indexOf(event);
  const prev = EVENTS[i - 1];
  const next = EVENTS[i + 1];

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 pt-8 pb-14">
      <BackLink href="/history">행정구역 변천사</BackLink>

      {/* 연도와 사건이 제목이다. 그 위에 설명을 얹지 않는다. */}
      <header className="flex items-end justify-between gap-5">
        <h1 className="shrink-0 font-mono text-6xl leading-none font-bold tabular-nums sm:text-7xl">
          {event.at}
        </h1>
        <div className="flex flex-col items-end gap-1">
          {/*
            실제 날짜를 모르면 그렇다고 밝힌다. 자료의 해는 시행일보다 늦을 수
            있다 — 제주특별자치도는 2006년 출범인데 2007년 판에서야 바뀐다.
            아는 척하느니 어디까지 아는지를 적는다.
          */}
          {!event.dated && (
            <p className="font-mono text-xs tabular-nums text-dim">
              자료에 처음 나타난 해
            </p>
          )}
        </div>
      </header>

      <EventMaps event={event} />

      <nav className="flex justify-between gap-4 border-t border-edge pt-4 text-base">
        {prev ? (
          <Link href={`/history/${prev.year}`} className="text-dim hover:text-ink">
            ← {prev.year}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/history/${next.year}`} className="text-dim hover:text-ink">
            {next.year} →
          </Link>
        )}
      </nav>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<"/history/[year]">) {
  const { year } = await params;
  const event = find(year);
  if (!event) return {};

  const title = `${event.at}년 행정구역 개편 — ${event.headline}`;
  return {
    title: title.slice(0, 90),
    description: `${event.states[0].year}년과 ${event.states.at(-1)!.year}년 지도를 나란히 놓고 봅니다. ${event.headline}`.slice(
      0,
      300,
    ),
    alternates: { canonical: `/history/${year}` },
  };
}

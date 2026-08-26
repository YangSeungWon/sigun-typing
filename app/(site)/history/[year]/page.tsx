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

  /*
   * 이웃은 **연도순으로** 잡는다.
   *
   * 배열 차례를 그대로 쓰고 있었는데, 읍면동 층의 부천 이야기(2019)가 뒤에
   * 덧붙어 있어서 2024의 다음이 2019가 됐다. 시간축이 갑자기 되감기는 것처럼
   * 보이고, 실제로는 그 페이지가 2018과 2023 사이에 놓일 이야기다.
   */
  const order = [...EVENTS].sort((a, b) => a.year.localeCompare(b.year));
  const i = order.indexOf(event);
  const prev = order[i - 1];
  const next = order[i + 1];

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
            **큰 숫자는 실제로 일어난 해다.** 주소와 목록의 해는 그것이 경계
            자료에 처음 나타난 해이고, 둘이 다른 경우가 있다 — 대구·인천직할시는
            1981년에 생겼는데 자료가 5년 단위라 1985년 판에서 처음 보인다.

            그동안 이 페이지는 큰 숫자만 실제 해로 바꿔 놓고 그 사정을 안
            적었다. 목록에서 `1985`를 누르고 들어와 `1981`을 보면 어느 쪽이
            맞는지 알 수가 없다. 다르면 다르다고 적는다.
          */}
          {event.at !== event.year && (
            <p className="font-mono text-xs tabular-nums text-dim">
              {event.year}년 자료에서 확인
            </p>
          )}
          {/*
            실제 날짜를 모르면 그렇다고 밝힌다. 아는 척하느니 어디까지 아는지를
            적는다.
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

  /*
   * 제목은 한 꼴로 짧게.
   *
   * `${event.at}년 행정구역 개편 — ${headline}`을 90자로 자르고 있었다. 1995년은
   * 변화가 예순네 건이라 그 목록이 이어 붙어 검색 결과에서 잘린 문장으로 뜬다.
   * 구체적인 `A → B`는 설명문으로 보낸다 — 거기는 300자다.
   */
  return {
    title: `${event.at}년 행정구역 개편`,
    description: `${event.states[0].year}년과 ${event.states.at(-1)!.year}년 지도를 나란히 놓고 봅니다. ${event.headline}`.slice(
      0,
      300,
    ),
    alternates: { canonical: `/history/${year}` },
  };
}

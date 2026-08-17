import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { Timelapse, type TimelapseData } from "@/components/Timelapse";
import timelapse from "@/data/timelapse/sido.json";
import changes from "@/data/reference/boundary-changes.json";
import events from "@/data/timelapse/events.json";

const DATA = timelapse as TimelapseData;
const FIRST = DATA.frames[0];
const LAST = DATA.frames[DATA.frames.length - 1];

/** 전후 지도를 구워 둔 해. 나머지는 목록에만 남는다. */
const DRAWN = new Set(events.events.map((e) => e.year));

export const metadata = {
  title: `대한민국 행정구역 변천사 ${FIRST.year}~${LAST.year}`,
  description: `시도가 ${FIRST.regions.length}개에서 ${LAST.regions.length}개로 늘기까지. 직할시 승격, 광역시 개편, 세종특별자치시 신설까지 지도로 봅니다.`,
  alternates: { canonical: "/history" },
};

/**
 * 행정구역 변천사.
 *
 * 이 게임이 가르치는 것은 지금의 지도인데, "왜 이 이름인가"는 지금의 지도에
 * 안 적혀 있다. 부산이 왜 광역시인지, 세종은 왜 도가 없는지, 울산은 왜 늦게
 * 생겼는지 — 그건 시간 축에만 있다.
 *
 * 그래서 이 페이지는 문제를 내지 않는다. 읽고 나가는 자리다. 대신 게임에서
 * 만난 이름이 여기서 설명되고, 여기서 본 사람이 게임으로 갈 수 있게 한다.
 *
 * 시도만 다룬다. 시군구는 이 축척에서 안 보인다 — 창원 통합도 청주 통합도
 * 전국 지도에서는 몇 픽셀이라, 그쪽은 사건마다 그 자리를 확대해야 한다.
 */
export default function HistoryPage() {
  const sigungu = changes.sigungu.filter((e) => Number(e.from) >= 2000);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 pt-8 pb-14">
      <BackLink href="/">시군 타이핑</BackLink>

      <Timelapse data={DATA} />

      {/*
        시군구 개편은 위 지도에 안 담긴다 — 전국 축척에서 창원 통합도 청주
        통합도 몇 픽셀이다. 대신 사건마다 자기 자리를 확대한 페이지가 있고,
        여기가 그 문이다.
      */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">시군구</h2>
        <ul className="flex flex-col divide-y divide-concrete-deep border-y border-concrete-deep">
          {sigungu.map((e) => {
            const row = (
              <>
                <span className="shrink-0 font-mono text-sm tabular-nums text-dim">
                  {e.to}
                </span>
                <span className="flex flex-col gap-0.5 text-base break-keep">
                  {e.born.length > 0 && <span>{e.born.join(", ")} 생김</span>}
                  {e.gone.length > 0 && (
                    <span className="text-dim">{e.gone.join(", ")} 사라짐</span>
                  )}
                </span>
              </>
            );
            /*
             * 지도가 있는 해만 링크가 된다. 시도 셋 이상에 걸친 해는 확대해도
             * 안 보여서 굽지 않았다(`scripts/build-history-events.mts`).
             */
            return (
              <li key={`${e.from}-${e.to}`}>
                {DRAWN.has(e.to) ? (
                  <Link
                    href={`/history/${e.to}`}
                    className="flex gap-4 py-2.5 transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                  >
                    {row}
                  </Link>
                ) : (
                  <span className="flex gap-4 py-2.5">{row}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/*
        자료의 나이를 밝힌다. 이 게임의 지역 데이터가 2025년 기준이라는 것과
        같은 이유다 — 언제까지 반영된 자료인지 모르면 빠진 것이 오류인지
        시점 차이인지 알 수 없다.
      */}
      <p className="text-sm break-keep text-dim">
        통계청 SGIS 센서스용 행정구역경계(1975~2025)를 바탕으로 만들었습니다.
        경계가 실제로 달라진 해만 그립니다.
      </p>
    </main>
  );
}

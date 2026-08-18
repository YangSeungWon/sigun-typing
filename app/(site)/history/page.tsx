import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { Timelapse, type TimelapseData } from "@/components/Timelapse";
import timelapse from "@/data/timelapse/sido.json";
import changes from "@/data/reference/boundary-changes.json";
import { UNMAPPED } from "@/data/reference/admin-events";
import { DATA_VINTAGE } from "@/data/vintage";
import eventYears from "@/data/timelapse/event-years.json";
import summaries from "@/data/timelapse/event-summaries.json";

const DATA = timelapse as TimelapseData;
const FIRST = DATA.frames[0];
const LAST = DATA.frames[DATA.frames.length - 1];

/** 전후 지도를 구워 둔 해. 나머지는 목록에만 남는다. */
const DRAWN = new Set(eventYears);

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
  /*
   * 다 보여 준다.
   *
   * 2000년 이후만 두고 있었는데, 그러면 **가장 큰 사건이 잘린다** —
   * 1990~1995년에 시군구가 58곳 사라지고 37곳 생겼다(도농통합). 목록을
   * 짧게 두려고 넣은 필터가 정작 볼 것을 가리고 있었다.
   */
  const sigungu = changes.sigungu;

  /*
   * 무엇이 무엇으로 바뀌었는지를 **짝으로** 적는다.
   *
   * 원본의 생김·사라짐 목록을 그대로 늘어놓고 있었다. 그러면 1995년이 이름
   * 예순 개의 벽이 되고, 무엇보다 `나주군 사라짐`은 절반만 참이다 —
   * 나주시와 나주군이 합쳐져 나주시가 된 것이고, 사라진 것은 이름이지
   * 땅이 아니다. 그 짝은 도형에서만 나온다(build-history-events.mts).
   *
   * 넉 줄만 보일 때 무엇을 앞에 세우는가가 곧 그해의 요약이다. 손으로 적어
   * 둔 줄(직할시 승격 같은 것)이 먼저, 그다음이 여럿을 하나로 합친 줄이다 —
   * 1995년의 이야기는 도농통합인데 그게 뒤로 밀리면 넉 줄을 보고도 그해가
   * 무슨 해인지 알 수 없다.
   */
  const paired = (year: string) => {
    type Row = { dated?: boolean; from: string[]; to: string[] };
    const all = (summaries as Record<string, Row[]>)[year] ?? [];
    const rank = (c: Row) => (c.dated ? 0 : c.from.length > 1 ? 1 : 2);
    const sorted = [...all].sort((a, b) => rank(a) - rank(b));
    return { all, shown: all.length > 6 ? sorted.slice(0, 4) : sorted };
  };

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
        {/*
          앞쪽 다섯 줄은 5년치가 뭉쳐 있다. 자료가 그 간격이라 나눌 수가 없고,
          한 해의 일이 아니므로 지도도 없다 — 그걸 밝히지 않으면 1995년 하루에
          쉰여덟 곳이 사라진 것처럼 읽힌다.
        */}
        <p className="text-sm break-keep text-dim">
          2000년까지는 자료가 5년 단위라 그사이 일이 한 줄에 뭉쳐 있습니다.
        </p>
        <ul className="flex flex-col divide-y divide-concrete-deep border-y border-concrete-deep">
          {sigungu.map((e) => {
            const { all, shown } = paired(e.to);
            const rest = all.length - shown.length;
            const row = (
              <>
                <span className="shrink-0 font-mono text-sm tabular-nums text-dim">
                  {e.to}
                </span>
                <span className="flex flex-col gap-1 text-base break-keep">
                  {shown.map((c, i) => (
                    <span key={i} className="flex flex-wrap items-baseline gap-x-2">
                      {c.from.length > 0 && (
                        <span className={c.to.length ? "text-dim" : ""}>
                          {c.from.join(", ")}
                        </span>
                      )}
                      {c.from.length > 0 && c.to.length > 0 && (
                        <span aria-label="에서" className="font-mono text-dim">
                          →
                        </span>
                      )}
                      {c.to.length > 0 && (
                        <span className="font-medium">{c.to.join(", ")}</span>
                      )}
                      {c.from.length === 0 && <span className="text-sm text-dim">생김</span>}
                      {c.to.length === 0 && <span className="text-sm text-dim">사라짐</span>}
                    </span>
                  ))}
                  {rest > 0 && (
                    <span className="font-mono text-sm text-dim">그 밖에 {rest}건</span>
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
        일어났지만 지도가 없는 개편.

        빼 두면 연표가 2024년에서 끝나는데, 그건 사실이 아니라 자료의
        한계다 — 가장 최근의 가장 큰 개편이 없는 연표는 낡은 것처럼 읽힌다.
        여기 세워 두면 그 한계가 드러나고, 게임이 왜 아직 `광주광역시`를
        묻는지도 같은 자리에서 설명된다.
      */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">아직 지도가 없는 개편</h2>
        <p className="text-sm break-keep text-dim">
          {DATA_VINTAGE.boundarySource}가 {DATA_VINTAGE.year}년까지라 아래는
          지도로 그리지 못했습니다. 게임의 정답도 같은 이유로 {DATA_VINTAGE.year}년
          기준입니다.
        </p>
        <ul className="flex flex-col divide-y divide-concrete-deep border-y border-concrete-deep">
          {UNMAPPED.map((c) => (
            <li
              key={c.to.join()}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-base break-keep"
            >
              <span className="text-dim">{c.from.join(", ")}</span>
              <span aria-label="에서" className="font-mono text-dim">
                →
              </span>
              <span className="font-medium">{c.to.join(", ")}</span>
            </li>
          ))}
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

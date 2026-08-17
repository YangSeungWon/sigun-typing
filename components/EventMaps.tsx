"use client";

import { useState } from "react";

export interface EventSide {
  year: string;
  regions: { code: string; name: string; d: string }[];
  marked: string[];
}

export interface HistoryEvent {
  /** 자료에 처음 나타난 해. 주소가 된다. */
  year: string;
  /** 크게 뜨는 해 — 실제로 그 일이 있었던 해. */
  at: string;
  /** 실제 날짜를 아는가. */
  dated: boolean;
  headline: string;
  before: EventSide;
  after: EventSide;
}

/**
 * 개편 하나를 **한 장의 지도에서** 보여 준다.
 *
 * 전후를 나란히 놓아 봤는데, 두 장을 눈으로 왕복하며 견주는 일을 읽는 사람에게
 * 떠넘기는 꼴이었다 — 스물몇 개 도형 중에 무엇이 달라졌는지 찾아내야 한다.
 * 한 장에서 그 자리만 바뀌면 찾을 것이 없다.
 *
 * 두 시점이 같은 투영을 쓰므로(`scripts/build-history-events.mts`) 안 바뀐
 * 곳은 제자리에 그대로 있다. 도형에 `d` 전환을 걸어 두면 바뀐 곳만 모양이
 * 흐르듯 옮겨 간다 — 합쳐지는 것도 갈라지는 것도 그 움직임으로 읽힌다.
 *
 * 사라지는 쪽은 빨강, 생기는 쪽은 초록이다.
 */
export function EventMaps({
  event,
  width,
  height,
}: {
  event: HistoryEvent;
  width: number;
  height: number;
}) {
  /*
   * 처음에는 **바뀌기 전**을 보여 준다.
   *
   * 결과부터 보여 주면 누를 이유가 없다. 앞을 먼저 두면 단추 한 번이 곧
   * 그 사건이 된다.
   */
  const [showAfter, setShowAfter] = useState(false);
  const side = showAfter ? event.after : event.before;

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${side.year}년 ${side.regions.length}곳`}
      >
        {side.regions.map((r) => {
          const hit = side.marked.includes(r.code);
          return (
            /*
             * key를 코드로 준다. 두 시점에 같은 코드가 있으면 같은 엘리먼트라
             * path만 갈리고, 그 사이를 CSS가 이어 준다.
             */
            <path
              key={r.code}
              d={r.d}
              className={`stroke-[var(--color-map-line)] transition-[d,fill] duration-700 ${
                hit
                  ? showAfter
                    ? "fill-[var(--color-sign)]"
                    : "fill-[var(--color-alert)]"
                  : "fill-[var(--color-map-idle)]"
              }`}
              strokeWidth={0.8}
            >
              <title>{r.name}</title>
            </path>
          );
        })}
      </svg>

      {/*
        두 해를 단추로 나란히 둔다. 어느 쪽을 보고 있는지가 눌린 모양으로
        읽히고, 오가며 견주는 것이 이 화면에서 할 일의 전부다.
      */}
      <div className="flex items-center gap-2">
        {([event.before, event.after] as const).map((s, i) => {
          const active = (i === 1) === showAfter;
          return (
            <button
              key={s.year}
              type="button"
              onClick={() => setShowAfter(i === 1)}
              aria-current={active}
              className={`rounded-lg border px-4 py-2 font-mono text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                active
                  ? "border-ink bg-ink text-paint"
                  : "border-concrete-deep text-dim hover:bg-concrete-deep hover:text-ink"
              }`}
            >
              {s.year}
            </button>
          );
        })}
        <span className="ml-1 text-sm text-dim">
          {showAfter ? "생긴 곳" : "사라진 곳"}
          <span
            className={`ml-2 inline-block h-3 w-3 translate-y-0.5 rounded-sm ${
              showAfter ? "bg-sign" : "bg-[var(--color-alert)]"
            }`}
          />
        </span>
      </div>
    </div>
  );
}

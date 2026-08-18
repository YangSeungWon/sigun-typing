"use client";

import { useState } from "react";

export interface DongStory {
  name: string;
  parent: string;
  states: { year: string; regions: { code: string; name: string; d: string }[] }[];
}

/**
 * 한 동네의 읍면동이 나뉘고 합쳐진 자취.
 *
 * 짚어 칠하지 않는다. 동네가 통째로 다시 나뉜 사건이라 바뀐 곳을 칠하면
 * 지도가 한 덩어리 색이 된다 — **조각 수가 달라지는 것 자체가 사건**이다.
 *
 * 시점들이 같은 투영을 쓰므로 동네는 제자리에 있고 안쪽 선만 움직인다.
 */
export function DongHistory({ story }: { story: DongStory }) {
  const [index, setIndex] = useState(0);
  const side = story.states[index];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {story.states.map((s, i) => (
          <button
            key={s.year}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index}
            className={`rounded-lg border px-3.5 py-2 font-mono text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              i === index
                ? "border-ink bg-ink text-paint"
                : "border-concrete-deep text-dim hover:bg-concrete-deep hover:text-ink"
            }`}
          >
            {s.year}
            <span className="ml-2 opacity-60">{s.regions.length}</span>
          </button>
        ))}
      </div>

      <svg
        viewBox="0 0 460 460"
        className="mx-auto h-auto max-h-[46vh] w-auto max-w-full"
        role="img"
        aria-label={`${side.year}년 ${side.regions.length}곳`}
      >
        {side.regions.map((r) => (
          <path
            key={r.code}
            d={r.d}
            className="fill-[var(--color-map-idle)] stroke-[var(--color-map-line)] transition-[d] duration-700"
            strokeWidth={0.8}
          >
            <title>{r.name}</title>
          </path>
        ))}
      </svg>

      {/* 그때 그 이름들. 사라진 동 이름이 이 화면에서 유일하게 남는 자리다. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-dim">
        {side.regions.map((r) => (
          <li key={r.code}>{r.name}</li>
        ))}
      </ul>
    </div>
  );
}

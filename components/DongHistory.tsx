"use client";

import { useState } from "react";

export interface DongChange {
  from: string[];
  to: string[];
}

export interface DongStory {
  name: string;
  parent: string;
  states: {
    year: string;
    regions: { code: string; name: string; d: string }[];
    /** 앞 시점에서 이 시점으로 오며 무엇이 무엇이 됐는가. 첫 시점에는 없다. */
    changes?: DongChange[];
  }[];
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
  const [hover, setHover] = useState<string[] | null>(null);
  const side = story.states[index];

  /*
   * 표는 **고른 시점으로 오며** 무엇이 달라졌는지를 적는다.
   *
   * 첫 시점에는 그런 것이 없으므로 그다음 것을 보여 준다 — 첫 화면에서 표가
   * 비어 있으면 이 페이지에 표가 있다는 것조차 모른다.
   */
  const changes = story.states[Math.max(index, 1)]?.changes ?? [];

  /* 손을 얹은 줄의 이름 중 지금 지도에 있는 것만 짚는다. */
  const lit = new Set(hover ?? []);

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
            className={`stroke-[var(--color-map-line)] transition-[d,fill] duration-700 ${
              lit.has(r.name) ? "fill-[var(--color-sign)]" : "fill-[var(--color-map-idle)]"
            }`}
            strokeWidth={0.8}
          >
            <title>{r.name}</title>
          </path>
        ))}
      </svg>

      {/*
        무엇이 무엇이 됐는지.

        이름만 늘어놓으면 삼선1동과 삼선2동이 없어진 것까지는 보이는데 어디로
        갔는지가 없다. 한 줄이 곧 한 사건이라 건수가 늘어도 세로로 쌓인다.

        줄에 손을 얹으면 지도에서 그 동들을 짚는다. 이름과 도형을 잇는 일이
        이 화면에서 제일 어려운데, 그걸 읽는 사람이 하지 않아도 된다.
      */}
      {changes.length > 0 && (
        <ul className="flex flex-col divide-y divide-concrete-deep border-y border-concrete-deep">
          {changes.map((c, i) => (
            <li
              key={i}
              onMouseEnter={() => setHover([...c.from, ...c.to])}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover([...c.from, ...c.to])}
              onBlur={() => setHover(null)}
              tabIndex={0}
              className="flex cursor-default flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5 text-base break-keep transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
            >
              {c.from.length > 0 && (
                <span className={c.to.length ? "text-dim" : ""}>{c.from.join(", ")}</span>
              )}
              {c.from.length > 0 && c.to.length > 0 && (
                <span aria-label="에서" className="font-mono text-dim">
                  →
                </span>
              )}
              {c.to.length > 0 && <span className="font-medium">{c.to.join(", ")}</span>}
              {c.from.length === 0 && <span className="text-sm text-dim">생김</span>}
              {c.to.length === 0 && <span className="text-sm text-dim">사라짐</span>}
            </li>
          ))}
        </ul>
      )}

      {/* 그때 그 이름들. 사라진 동 이름이 이 화면에서 유일하게 남는 자리다. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-dim">
        {side.regions.map((r) => (
          <li key={r.code}>{r.name}</li>
        ))}
      </ul>
    </div>
  );
}

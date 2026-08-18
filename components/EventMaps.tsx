"use client";

import { useState } from "react";

export interface EventSide {
  /** 단추에 적을 시점. `2011`이거나 `2012.01`이다. */
  year: string;
  regions: { code: string; name: string; d: string }[];
  marked: string[];
  tone: "gone" | "born";
}

interface Named {
  name: string;
  code?: string;
}

export interface EventChange {
  on?: string;
  from: Named[];
  to: Named[];
}

export interface HistoryEvent {
  /** 자료에 처음 나타난 해. 주소가 된다. */
  year: string;
  /** 크게 뜨는 해 — 실제로 그 일이 있었던 해. */
  at: string;
  /** 실제 날짜를 아는가. */
  dated: boolean;
  changes: EventChange[];
  headline: string;
  /** 이 사건의 판 크기. 전국에 걸친 사건은 더 길다. */
  width: number;
  height: number;
  /** 전국에 걸친 사건인가. */
  nationwide: boolean;
  /** 앞에서 뒤로 가는 상태들. 보통 둘, 한 판에 사건이 둘이면 셋. */
  states: EventSide[];
}

/**
 * 개편 하나.
 *
 * 지도는 **한 장**이다. 전후를 나란히 놓아 봤는데, 두 장을 눈으로 왕복하며
 * 견주는 일을 읽는 사람에게 떠넘기는 꼴이었다 — 스물몇 개 도형 중에 무엇이
 * 달라졌는지 찾아내야 한다. 한 장에서 그 자리만 바뀌면 찾을 것이 없다.
 *
 * 무엇이 바뀌었는지는 **표로** 적는다. `A가 B로 · C가 D로`처럼 문장으로
 * 이으면 건수가 늘 때마다 길어지고 눈이 세로로 훑을 수가 없다.
 *
 * 표의 한 줄에 손을 얹으면 지도에서 그 곳만 짚는다. 이름과 도형을 잇는 일이
 * 이 화면에서 제일 어려운데, 그걸 읽는 사람이 하지 않아도 된다.
 */
export function EventMaps({ event }: { event: HistoryEvent }) {
  const { width, height } = event;
  /*
   * 처음에는 **바뀌기 전**을 보여 준다.
   *
   * 결과부터 보여 주면 누를 이유가 없다. 앞을 먼저 두면 단추 한 번이 곧
   * 그 사건이 된다.
   */
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState<string[] | null>(null);
  const side = event.states[index];

  /* 손을 얹은 줄이 있으면 그것만 짚는다. 없으면 이 시점에 달라진 것들. */
  const lit = hover ?? side.marked;

  /*
   * **반대편 시점을 점선으로 겹친다.**
   *
   * 전후가 둘 다 있는데 단추를 눌러야만 다른 쪽이 보였다. 그러면 견주는 일이
   * 여전히 읽는 사람 몫이다 — 눌러 보고, 기억하고, 다시 눌러 견준다.
   *
   * 겹쳐 두면 누를 것이 없다. 통합된 나주시 안에 옛 나주시와 나주군을 가르던
   * 선이 점선으로 남고, 그 선 하나가 곧 그 사건이다. 단추는 한쪽을 또렷이
   * 보고 싶을 때만 쓰면 된다.
   *
   * 짚은 곳만 그린다. 안 바뀐 경계까지 겹치면 두 장을 포개 놓은 것일 뿐이라
   * 어디가 달라졌는지 도로 안 보인다.
   */
  const other = event.states[index === 0 ? event.states.length - 1 : 0];
  const ghost = other === side ? [] : other.regions.filter((r) => other.marked.includes(r.code));

  return (
    <div className="flex flex-col gap-4">
      {/*
        고르는 자리는 지도 **위**다. 아래 두면 무엇을 할 수 있는 화면인지
        알려면 지도를 지나쳐야 한다.
      */}
      <div className="flex flex-wrap items-center gap-2">
        {event.states.map((s, i) => (
          <button
            key={s.year}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index}
            className={`rounded-lg border px-4 py-2 font-mono text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              i === index
                ? "border-ink bg-ink text-paint"
                : "border-concrete-deep text-dim hover:bg-concrete-deep hover:text-ink"
            }`}
          >
            {s.year}
          </button>
        ))}
      </div>

      {/*
        높이를 잡아 둔다.
        정사각 지도에 폭을 다 주면 본문 너비만큼 키가 커져서, 정작 무엇이
        바뀌었는지 적은 표가 화면 밖으로 밀린다. 지도와 표가 한 화면에
        같이 있어야 서로를 설명한다.
      */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto h-auto max-h-[46vh] w-auto max-w-full"
        role="img"
        aria-label={`${side.year} ${side.regions.length}곳`}
      >
        {side.regions.map((r) => {
          const hit = lit.includes(r.code);
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
                  ? side.tone === "born"
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

        {/*
          반대편 시점의 경계. 채우지 않는다 — 지금 보는 지도를 가리면 안 된다.

          바탕색으로 긋는다. 이 선이 놓이는 자리는 거의 언제나 짚어 놓은
          빨강이나 초록 위다(양쪽이 같은 땅을 두고 갈린 것이 이 사건이니까).
          어두운 선으로는 그 위에서 안 읽혔다.
        */}
        <g fill="none" className="pointer-events-none stroke-[var(--color-paint)]" aria-hidden>
          {ghost.map((r) => (
            <path key={r.code} d={r.d} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.9} />
          ))}
        </g>
      </svg>

      {/*
        점선이 무엇인지 한 번은 밝혀야 한다. 지도 아래 한 줄이면 되고,
        아무것도 겹치지 않은 시점에서는 이 줄도 없다.
      */}
      {ghost.length > 0 && (
        <p className="text-center font-mono text-xs text-dim">
          점선은 {other.year}년 경계
        </p>
      )}

      {/*
        바뀐 내용은 표다.
        왼쪽이 전, 오른쪽이 후. 한 줄이 곧 한 사건이라 건수가 늘어도 세로로
        쌓일 뿐 문장이 길어지지 않는다.
      */}
      <ul className="flex flex-col divide-y divide-concrete-deep border-y border-concrete-deep">
        {event.changes.map((c, i) => {
          const codes = [...c.from, ...c.to].map((x) => x.code).filter(Boolean) as string[];
          return (
            <li
              key={i}
              onMouseEnter={() => setHover(codes)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(codes)}
              onBlur={() => setHover(null)}
              tabIndex={codes.length > 0 ? 0 : undefined}
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
                codes.length > 0 ? "cursor-default hover:bg-concrete-deep" : ""
              }`}
            >
              {c.on && (
                <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-dim">
                  {c.on}
                </span>
              )}
              <span className="flex flex-wrap items-baseline gap-2 text-base break-keep">
                {c.from.length > 0 && (
                  <span className={c.to.length ? "text-dim" : ""}>
                    {c.from.map((x) => x.name).join(", ")}
                  </span>
                )}
                {c.from.length > 0 && c.to.length > 0 && (
                  <span aria-label="에서" className="font-mono text-dim">
                    →
                  </span>
                )}
                {c.to.length > 0 && (
                  <span className="font-medium">{c.to.map((x) => x.name).join(", ")}</span>
                )}
                {c.from.length === 0 && <span className="text-sm text-dim">생김</span>}
                {c.to.length === 0 && <span className="text-sm text-dim">사라짐</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

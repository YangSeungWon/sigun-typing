"use client";

import { useState } from "react";

export interface EventSide {
  /** 단추에 적을 시점. `2011`이거나 `2012.01`이다. */
  year: string;
  regions: { code: string; name: string; d: string; at?: [number, number]; label?: string }[];
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
 * 지도를 **나란히** 놓는다.
 *
 * 한 장에 두고 단추로 오가게 했었다. 나란히 놓으면 두 장을 눈으로 왕복하며
 * 견주는 일을 읽는 사람에게 떠넘기는 꼴이라고 봤기 때문이다 — 스물몇 개
 * 도형 중에 무엇이 달라졌는지 찾아내야 했다.
 *
 * 그 전제가 그 뒤에 달라졌다. 판이 바뀐 자리로 좁혀졌고 짚은 곳에 이름이
 * 붙었다. 이제 찾을 것이 없다. 그런데 한 장으로 두면 **처음 들어온 사람은
 * 앞 시점만 본다** — 누르기 전에는 무엇이 달라졌는지 알 수가 없다. 개편은
 * 전과 후가 함께 있어야 성립하는 이야기다.
 *
 * 무엇이 바뀌었는지는 **표로** 적는다. `A가 B로 · C가 D로`처럼 문장으로
 * 이으면 건수가 늘 때마다 길어지고 눈이 세로로 훑을 수가 없다.
 *
 * 표의 한 줄에 손을 얹으면 지도에서 그 곳만 짚는다. 이름과 도형을 잇는 일이
 * 이 화면에서 제일 어려운데, 그걸 읽는 사람이 하지 않아도 된다.
 */
export function EventMaps({ event }: { event: HistoryEvent }) {
  const { width, height } = event;
  const [hover, setHover] = useState<string[] | null>(null);

  const first = event.states[0];
  const last = event.states[event.states.length - 1];

  /*
   * **뒤 지도에만 앞 경계를 점선으로 겹친다.**
   *
   * 통합된 창원시 안에 옛 창원·마산·진해를 가르던 선이 남고, 그 선 하나가
   * 곧 그 사건이다. 앞 지도에는 안 겹친다 — 바로 옆에 뒤 지도가 있으므로
   * 같은 말을 두 번 하는 셈이고, 두 판이 다 점선이면 어느 쪽이 언제인지
   * 헷갈린다.
   *
   * 모양이 그대로인 것은 뺀다. 군위군이 대구로 옮긴 해에는 땅이 달라지지
   * 않아 점선이 지금 그린 선 위에 그대로 포개진다.
   */
  const drawn = new Set(last.regions.map((r) => r.d));
  const ghost =
    first === last || event.nationwide
      ? /* 전국 판에서는 점선 이백 줄이 아무것도 말하지 않는다. 두 장을 견주는 것이 그 사건이다. */
        []
      : first.regions.filter((r) => first.marked.includes(r.code) && !drawn.has(r.d));

  /** 한 시점 지도 한 장. 짚은 곳은 칠하고 이름을 얹는다. */
  const Frame = ({ side, dashed }: { side: EventSide; dashed: boolean }) => {
    /* 손을 얹은 줄이 있으면 그것만 짚는다. 없으면 이 시점에 달라진 것들. */
    const lit = hover ?? side.marked;
    return (
      <figure className="flex min-w-0 flex-1 flex-col gap-2">
        <figcaption className="text-center font-mono text-sm tabular-nums">
          {side.year}
          {/*
            몇 곳이었나가 곧 그 사건이다. 도농통합처럼 전국이 물든 판은 도형
            하나하나를 읽을 수 없고, 270에서 247로 줄었다는 수가 지도가 못
            하는 말을 한다.
          */}
          <span className="ml-2 text-dim">{side.regions.length}곳</span>
        </figcaption>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto h-auto w-full"
          role="img"
          aria-label={`${side.year} ${side.regions.length}곳`}
        >
          {side.regions.map((r) => {
            const hit = lit.includes(r.code);
            return (
              <path
                key={r.code}
                d={r.d}
                className={`stroke-[var(--color-map-line)] transition-[fill] duration-300 ${
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
          {dashed && (
            <g fill="none" className="pointer-events-none stroke-[var(--color-paint)]" aria-hidden>
              {ghost.map((r) => (
                <path key={r.code} d={r.d} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.9} />
              ))}
            </g>
          )}

          {/*
            짚은 곳의 이름.
            도형만으로는 어느 것이 청원군인지 알 수 없어, 표의 줄에 손을 얹기
            전에는 지도가 아무 말도 안 했다. 글자 뒤에 바탕색 테두리를 둘러
            경계선 위에 놓여도 읽히게 한다.
          */}
          <g className="pointer-events-none" aria-hidden>
            {side.regions
              .filter((r) => r.at && lit.includes(r.code))
              .map((r) => (
                <text
                  key={r.code}
                  x={r.at![0]}
                  y={r.at![1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-[var(--color-ink)] stroke-[var(--color-paint)] text-[16px] font-semibold"
                  strokeWidth={3.5}
                  paintOrder="stroke"
                >
                  {r.label}
                </text>
              ))}
          </g>
        </svg>
      </figure>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/*
        좁은 화면에서는 위아래로 쌓인다. 그래도 둘 다 한 화면에 들어오므로
        누르지 않고 견줄 수 있다는 것은 그대로다.
      */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {event.states.map((side, i) => (
          <Frame key={side.year} side={side} dashed={i === event.states.length - 1} />
        ))}
      </div>

      {/*
        점선이 무엇인지 한 번은 밝혀야 한다. 지도 아래 한 줄이면 되고,
        아무것도 겹치지 않은 사건에서는 이 줄도 없다.
      */}
      {ghost.length > 0 && (
        <p className="text-center font-mono text-xs text-dim">점선은 {first.year}년 경계</p>
      )}

      {/*
        바뀐 내용은 표다.
        왼쪽이 전, 오른쪽이 후. 한 줄이 곧 한 사건이라 건수가 늘어도 세로로
        쌓일 뿐 문장이 길어지지 않는다.
      */}
      <ul className="flex flex-col divide-y divide-edge border-y border-edge">
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

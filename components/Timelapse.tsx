"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TimelapseFrame {
  year: string;
  label: string;
  regions: { code: string; name: string; d: string }[];
}

export interface TimelapseData {
  width: number;
  height: number;
  frames: TimelapseFrame[];
}

/** 한 장이 머무는 시간. 라벨을 읽을 만큼은 길어야 한다. */
const HOLD_MS = 2200;

/**
 * 시도 경계 타임랩스.
 *
 * 프레임은 **바뀐 해에만** 있다(`scripts/build-timelapse.mts`). 그래서 이
 * 컴포넌트가 보여 주는 것은 "해마다 조금씩"이 아니라 "이 해에 이런 일이"다.
 * 연도 눈금을 균등 간격으로 두지 않고 실제 연도 위치에 찍는 것도 그래서다 —
 * 1975와 1985 사이는 십 년이고 2023과 2024 사이는 한 해다.
 *
 * 자동재생은 **기본으로 켜지 않는다.** 들어오자마자 움직이는 지도는 읽는
 * 사람의 자리를 뺏고, 애초에 이 페이지에 오는 사람은 특정 연도를 보러 오는
 * 경우가 많다. 재생은 눌러서 시작한다.
 */
export function Timelapse({ data }: { data: TimelapseData }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const frame = data.frames[index];
  const last = data.frames.length - 1;

  useEffect(() => {
    if (!playing) return;
    timer.current = setTimeout(() => {
      setIndex((i) => (i >= last ? 0 : i + 1));
    }, HOLD_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, index, last]);

  /* 직접 골랐으면 재생은 멈춘다 — 보려던 해가 지나가 버리면 안 된다. */
  const pick = useCallback((i: number) => {
    setPlaying(false);
    setIndex(i);
  }, []);

  const years = data.frames.map((f) => Number(f.year));
  const span = years[last] - years[0];
  const at = (i: number) => ((years[i] - years[0]) / span) * 100;

  /*
   * 눈금 라벨은 겹치면 지운다.
   *
   * 실제 연도 자리에 찍으므로 최근처럼 개편이 몰린 구간에서는 점이 붙는다 —
   * 2023과 2024는 50년 축에서 2% 거리라 `2324`로 읽혔다. 점은 다 두고 글자만
   * 솎는다. 고른 해는 언제나 보여야 하므로 그것만 예외다.
   */
  const MIN_GAP = 7;
  const labelled = new Set<number>();
  let lastAt = -Infinity;
  for (let i = 0; i < data.frames.length; i++) {
    if (at(i) - lastAt < MIN_GAP) continue;
    labelled.add(i);
    lastAt = at(i);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <svg
          viewBox={`0 0 ${data.width} ${data.height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${frame.year}년 대한민국 시도 경계. ${frame.regions.length}개.`}
        >
          {frame.regions.map((r) => (
            /*
             * key를 코드로 준다. 프레임이 바뀌어도 같은 시도는 같은 엘리먼트라
             * path만 갈리고, 새로 생긴 시도만 새로 그려진다.
             */
            <path
              key={r.code}
              d={r.d}
              className="fill-[var(--color-map-idle)] stroke-[var(--color-map-line)] transition-[d] duration-500"
              strokeWidth={1}
            >
              <title>{r.name}</title>
            </path>
          ))}
        </svg>

        {/* 연도는 지도 위에 크게. 이 화면에서 가장 먼저 읽혀야 하는 값이다. */}
        <div className="pointer-events-none absolute top-0 left-0 font-mono text-5xl font-bold tabular-nums sm:text-6xl">
          {frame.year}
        </div>
      </div>

      <div className="flex min-h-12 items-start justify-between gap-4">
        <p className="text-base break-keep text-dim">
          {frame.label || `시도 ${frame.regions.length}곳에서 시작한다.`}
        </p>
        <span className="shrink-0 font-mono text-sm tabular-nums text-dim">
          {frame.regions.length}곳
        </span>
      </div>

      {/*
        눈금은 실제 연도 자리에 찍는다. 균등 간격으로 두면 1975→1985의 십 년과
        2023→2024의 한 해가 같은 폭이 되어, 최근에 개편이 몰렸다는 사실이
        사라진다.
      */}
      <div className="relative h-10">
        <div className="absolute top-4 right-0 left-0 h-px bg-concrete-deep" />
        {data.frames.map((f, i) => (
          <button
            key={f.year}
            type="button"
            onClick={() => pick(i)}
            aria-current={i === index}
            aria-label={`${f.year}년`}
            className="absolute -translate-x-1/2 cursor-pointer p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            style={{ left: `${at(i)}%` }}
          >
            <span
              className={`block h-3 w-3 rounded-full transition-colors ${
                i === index ? "bg-sign" : "bg-concrete-deep hover:bg-dim"
              }`}
            />
            {/* 고른 해가 이긴다 — 그 옆에 붙는 글자는 활성 여부와 무관하게 물러난다. */}
            {(i === index ||
              (labelled.has(i) && Math.abs(at(i) - at(index)) >= MIN_GAP)) && (
              <span
                className={`mt-1 block font-mono text-[10px] tabular-nums ${
                  i === index ? "text-ink" : "text-dim"
                }`}
              >
                {f.year.slice(2)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            /* 끝에서 다시 누르면 처음부터. 멈춘 자리에서 안 움직이면 고장으로 보인다. */
            if (!playing && index >= last) setIndex(0);
            setPlaying((p) => !p);
          }}
          className="rounded-lg bg-sign px-5 py-2 text-base font-bold text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {playing ? "멈춤" : "재생"}
        </button>
        <button
          type="button"
          onClick={() => pick(Math.max(0, index - 1))}
          disabled={index === 0}
          className="rounded-lg border border-concrete-deep px-4 py-2 text-base transition-colors hover:bg-concrete-deep disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          이전
        </button>
        <button
          type="button"
          onClick={() => pick(Math.min(last, index + 1))}
          disabled={index === last}
          className="rounded-lg border border-concrete-deep px-4 py-2 text-base transition-colors hover:bg-concrete-deep disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          다음
        </button>
      </div>
    </div>
  );
}

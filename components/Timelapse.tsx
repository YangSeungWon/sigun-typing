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

  return (
    <div className="flex flex-col gap-5">
      {/*
        연도와 사건이 이 화면의 제목이다.
        페이지 제목은 따로 두지 않는다 — 첫 화면이 카피 대신 숫자를 h1으로
        둔 것과 같다. 여기서 읽을 것은 "몇 년에 무슨 일이 있었나"뿐이다.
      */}
      <header className="flex flex-col gap-1">
        <h1
          className="font-mono text-6xl leading-none font-bold tabular-nums sm:text-7xl"
          aria-label={`${frame.year}년. ${frame.label || `시도 ${frame.regions.length}곳`}`}
        >
          {frame.year}
        </h1>
        {/*
          높이를 고정한다. 사건 문장의 길이가 프레임마다 달라서(한 줄에서 세
          줄까지) 그대로 두면 아래 타임라인과 지도가 위아래로 튄다.
        */}
        <p className="flex min-h-14 items-start text-lg font-medium break-keep sm:min-h-8">
          {frame.label || `시도 ${frame.regions.length}곳`}
        </p>
      </header>

      {/*
        연도는 눌러서 고른다.
        점을 실제 연도 자리에 찍어 봤는데, 개편이 몰린 최근 구간에서 점과
        글자가 서로 밟았다. 아홉 개뿐이라 균등하게 늘어놓는 편이 읽기 쉽다 —
        어느 시기에 몰렸는지는 위의 사건 문장이 이미 말해 준다.
      */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            /* 끝에서 다시 누르면 처음부터. 멈춘 자리에서 안 움직이면 고장으로 보인다. */
            if (!playing && index >= last) setIndex(0);
            setPlaying((p) => !p);
          }}
          className="mr-1 rounded-lg bg-sign px-4 py-1.5 text-sm font-bold text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {playing ? "멈춤" : "재생"}
        </button>
        {data.frames.map((f, i) => (
          <button
            key={f.year}
            type="button"
            onClick={() => pick(i)}
            aria-current={i === index}
            className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              i === index
                ? "border-ink bg-ink text-paint"
                : "border-concrete-deep text-dim hover:bg-concrete-deep hover:text-ink"
            }`}
          >
            {f.year}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${data.width} ${data.height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${frame.year}년 대한민국 시도 경계 ${frame.regions.length}개`}
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
    </div>
  );
}

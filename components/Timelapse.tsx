"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TimelapseFrame {
  year: string;
  label: string;
  /** 이 해에 달라진 지역의 코드. 첫 프레임은 비어 있다. */
  changed: string[];
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
      {/*
        연도와 사건을 한 줄에 나란히 둔다.
        아래위로 쌓으면 사건 문장이 제 줄을 하나 더 차지하는데, 정작 연도
        오른쪽은 비어 있었다. 옆에 붙이면 그 폭을 그대로 쓴다.

        무엇보다 **높이가 안 흔들린다.** 사건 문장은 프레임마다 한 줄에서 세
        줄까지 오가지만, 연도 블록이 이미 두 줄만큼 높아서 그 안에 들어간다.
        전에는 최소 높이를 억지로 박아 두고 있었다.
      */}
      <header className="flex items-end justify-between gap-5">
        <h1
          className="shrink-0 font-mono text-6xl leading-none font-bold tabular-nums sm:text-7xl"
          aria-label={`${frame.year}년. ${frame.label || `시도 ${frame.regions.length}곳`}`}
        >
          {frame.year}
        </h1>
        <p className="text-right text-lg leading-snug font-medium break-keep">
          {frame.label || `시도 ${frame.regions.length}곳`}
        </p>
      </header>

      {/*
        재생 단추와 눈금을 한 줄에 붙여 **하나의 재생 막대**로 읽히게 한다.
        따로 놓으면 단추 하나와 연도 목록 하나로 보인다.

        눈금은 균등 간격이다. 실제 연도 자리에 찍어 봤더니 개편이 몰린 최근
        구간에서 점과 글자가 서로 밟았다 — 어느 시기에 몰렸는지는 위의 사건
        문장이 이미 말해 준다.
      */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            /* 끝에서 다시 누르면 처음부터. 멈춘 자리에서 안 움직이면 고장으로 보인다. */
            if (!playing && index >= last) setIndex(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "멈춤" : "재생"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sign text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden>
            {playing ? (
              <path d="M4 3h3v10H4zM9 3h3v10H9z" />
            ) : (
              <path d="M5 3l8 5-8 5z" />
            )}
          </svg>
        </button>

        <div className="relative flex-1">
          {/* 지나온 길과 남은 길. 어디쯤인지가 색으로 먼저 읽힌다. */}
          <div className="absolute top-[7px] right-1 left-1 h-0.5 bg-concrete-deep" />
          <div
            className="absolute top-[7px] left-1 h-0.5 bg-sign transition-[width] duration-500"
            style={{ width: `calc((100% - 0.5rem) * ${index / last})` }}
          />
          <div className="relative flex justify-between">
            {data.frames.map((f, i) => (
              <button
                key={f.year}
                type="button"
                onClick={() => pick(i)}
                aria-current={i === index}
                aria-label={`${f.year}년`}
                className="group flex cursor-pointer flex-col items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span
                  className={`block rounded-full transition-all ${
                    i === index
                      ? "h-4 w-4 bg-sign ring-2 ring-paint"
                      : i < index
                        ? "mt-[3px] h-2.5 w-2.5 bg-sign"
                        : "mt-[3px] h-2.5 w-2.5 bg-concrete-deep group-hover:bg-dim"
                  }`}
                />
                <span
                  className={`mt-1.5 font-mono text-xs tabular-nums transition-colors ${
                    i === index ? "font-bold text-ink" : "text-dim"
                  }`}
                >
                  {f.year}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${data.width} ${data.height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${frame.year}년 대한민국 시도 경계 ${frame.regions.length}개`}
      >
        {frame.regions.map((r) => {
          /*
           * 이 해에 달라진 곳만 칠한다. 지도가 다시 그려지기만 하면 무엇이
           * 바뀌었는지 안 보인다 — 인천이 경기도에서 떨어져 나온 해에도
           * 그냥 지도 한 장이다.
           *
           * 색은 게임에서 "맞힌 곳"에 쓰는 표지판 초록과 같다. 이 화면에서
           * 그 색이 하는 말은 다르지만("여기가 달라졌다"), 이 제품에서 초록은
           * 언제나 "눈여겨볼 곳"이라 서로 부딪치지 않는다.
           */
          const hit = frame.changed.includes(r.code);
          return (
            /*
             * key를 코드로 준다. 프레임이 바뀌어도 같은 시도는 같은 엘리먼트라
             * path만 갈리고, 새로 생긴 시도만 새로 그려진다.
             */
            <path
              key={r.code}
              d={r.d}
              className={`stroke-[var(--color-map-line)] transition-[d,fill] duration-500 ${
                hit ? "fill-[var(--color-sign)]" : "fill-[var(--color-map-idle)]"
              }`}
              strokeWidth={1}
            >
              <title>{hit ? `${r.name} — 이 해에 달라진 곳` : r.name}</title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}

"use client";

import { memo, useMemo } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { focusTransform } from "@/lib/geo/bbox";

export type MapVariant =
  /** 퀴즈 문제 — 어디인지만 보여주고 이름은 절대 쓰지 않는다 */
  | "hint"
  /** 진행·결과 — 달려온 경로 */
  | "route";

interface RegionMapProps {
  geo: CourseGeo;
  /** 지금 목표인 지역 코드 */
  currentCode?: string;
  /** 카메라가 볼 지역. 없으면 지금 문제를 본다. */
  focusCode?: string;
  /**
   * 이미 지나온 지역 코드. **순서가 의미를 가진다** — 마지막 항목이 방금
   * 맞힌 곳이고, 거기서만 색이 한 번 훑고 지나간다.
   */
  passedCodes?: string[];
  /** 포기했거나 틀린 채로 지나온 지역 코드 */
  missedCodes?: string[];
  variant: MapVariant;
  /**
   * 지금 문제인 지역으로 지도를 당길지.
   *
   * 전국 코스에서 서울은 점만 하다. 당겨 주지 않으면 어디를 묻는지 눈으로
   * 찾는 데만 시간이 걸리고, 그건 회상 능력과 아무 상관이 없다.
   * 전체 맥락은 옆에 붙는 미니맵이 맡는다.
   */
  focus?: boolean;
  className?: string;
}

/**
 * 코스 지도. 좌표 계산은 빌드 때 끝났으므로 여기서는 path를 칠하기만 한다.
 *
 * 색은 표지판과 같은 언어를 쓴다 — 지나온 곳은 표지판 녹색, 지금 칠 곳은 중앙선 노랑,
 * 아직 안 간 곳은 콘크리트 회색.
 */
/**
 * 타건 한 번마다 다시 그리지 않도록 memo로 감싼다. 전국 코스는 path가 250개고,
 * 지도는 한 문제 안에서는 아무것도 바뀌지 않는다 — 바뀌는 건 표지판뿐이다.
 * 부모는 passedCodes 배열의 정체성을 유지해야 이 memo가 실제로 걸린다.
 */
export const RegionMap = memo(function RegionMap({
  geo,
  currentCode,
  focusCode,
  passedCodes = EMPTY,
  missedCodes = EMPTY,
  variant,
  focus = false,
  className,
}: RegionMapProps) {
  const passed = useMemo(() => new Set(passedCodes), [passedCodes]);
  const missed = useMemo(() => new Set(missedCodes), [missedCodes]);
  const justPassed = passedCodes[passedCodes.length - 1];
  const current = useMemo(
    () => geo.regions.find((r) => r.code === currentCode),
    [geo, currentCode],
  );
  const camera = useMemo(
    () => geo.regions.find((r) => r.code === (focusCode ?? currentCode)),
    [geo, focusCode, currentCode],
  );
  const transform = useMemo(
    () => (focus ? focusTransform(camera, geo) : ""),
    [focus, camera, geo],
  );

  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      className={className}
      role="img"
      /*
       * 화면을 못 보는 사람에게도 진행이 전달되어야 한다. 지도는 그림이지만
       * 여기 담긴 정보는 "몇 곳 중 몇 곳을 했는가"이고 그건 말로 옮길 수 있다.
       * 가린 모드에서는 지역 이름을 절대 넣지 않는다 — 그게 답이다.
       */
      aria-label={
        variant === "hint"
          ? `지도에 표시된 지역 — ${geo.regions.length}곳 중 ${passed.size}곳 완료`
          : `${geo.regions.length}곳을 지나는 코스 지도 — ${passed.size}곳 맞힘` +
            (missed.size > 0 ? `, ${missed.size}곳 못 맞힘` : "")
      }
    >
      <defs>
        {/*
          못 맞힌 곳에는 색 위에 빗금을 덧댄다.
          초록과 빨강은 색각 이상에서 가장 흔히 겹치는 짝이다. 색만으로 가르면
          어떤 사람에게는 두 상태가 같은 그림이 된다.
        */}
        <pattern
          id="missed-hatch"
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={10}
            stroke="var(--color-paint)"
            strokeWidth={3}
            opacity={0.7}
          />
        </pattern>
      </defs>
      <g
        /*
         * 문제가 바뀔 때 화면이 미끄러지듯 옮겨 가야 "달리고 있다"는 감각이
         * 생긴다. viewBox 대신 transform을 쓰는 것이 이 한 줄을 위해서다.
         */
        style={{ transition: "transform 600ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
        transform={transform}
      >
        {geo.regions.map((r) => {
          const isCurrent = r.code === currentCode;
          const isPassed = passed.has(r.code);
          const isMissed = missed.has(r.code);
          return (
            <path
              d={r.d}
              /*
               * 노랑은 오직 "네가 답해야 할 것"만 가리킨다.
               *
               * 이름을 보여 주는 모드에서도 현재 지역을 노랑으로 칠했더니,
               * 지도는 문제를 내는 것처럼 보이는데 답은 판에 적혀 있어
               * 앞뒤가 맞지 않았다. 그 모드에서 현재 지역은 질문이 아니라
               * 위치이므로 밝은 초록 — 곧 칠해질 곳 — 으로 표시한다.
               */
              fill={
                isCurrent
                  ? variant === "hint"
                    ? "var(--color-centerline)"
                    : "var(--color-sign-hi)"
                  : isPassed
                    ? "var(--color-sign)"
                    : isMissed
                      ? // 지나왔지만 못 맞힌 곳. 아직 안 간 회색과 구분돼야
                        // 지도만 보고도 어디를 다시 봐야 하는지 읽힌다.
                        "var(--color-alert)"
                      : // 배경·면·경계선이 모두 비슷한 명도라 실루엣이 안개처럼 보였다.
                        "var(--color-map-idle)"
              }
              stroke="var(--color-map-line)"
              strokeWidth={2}
              strokeLinejoin="round"
              // 확대해도 경계선 두께는 그대로여야 지도가 뭉개지지 않는다.
              vectorEffect={focus ? "non-scaling-stroke" : undefined}
              /*
               * key를 바꿔 요소를 다시 붙이는 것으로 애니메이션을 재생한다.
               * 클래스를 껐다 켜는 방식보다 어긋날 여지가 없다.
               */
              key={r.code === justPassed ? `pass-${r.code}` : r.code}
              className={
                r.code === justPassed
                  ? "map-pass"
                  : "transition-[fill] duration-200"
              }
            />
          );
        })}
      </g>

      {/*
        현재 지역을 한 번 더 감싼다. 전국 지도에서 서울처럼 작은 지역은
        채우기만으로는 눈에 띄지 않는다. 이름은 쓰지 않는다 — 그게 문제니까.
      */}
      {/* 색 위에 얹는 빗금. 채우기와 별개의 층이라 색을 가리지 않는다. */}
      {missedCodes.length > 0 && (
        <g
          aria-hidden="true"
          style={{ transition: "transform 600ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
          transform={transform}
        >
          {geo.regions
            .filter((r) => missed.has(r.code))
            .map((r) => (
              <path key={r.code} d={r.d} fill="url(#missed-hatch)" />
            ))}
        </g>
      )}

      {currentCode && (
        <path
          // 테두리도 함께 움직여야 한다.
          style={{ transition: "transform 600ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
          transform={transform}
          d={current?.d}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={4}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
});

/** 기본값을 인라인 배열로 두면 렌더마다 새 배열이라 memo가 무력해진다. */
const EMPTY: string[] = [];

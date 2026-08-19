"use client";

import { memo, useCallback, useMemo } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { mainPathBox } from "@/lib/geo/bbox";

interface MiniMapProps {
  geo: CourseGeo;
  currentCode?: string;
  passedCodes?: string[];
  /**
   * 이번 문제에서 틀리게 부른 곳들.
   *
   * 큰 지도는 지금 묻는 곳으로 당겨져 있어서, 멀리 있는 오답은 화면 밖이라
   * 보이지 않는다 — 서울을 묻는데 부산을 불렀다면 부산은 지도 저편이다.
   * 카메라를 물리는 대신 여기에 찍는다. 전체 안에서 어디인가는 원래 이
   * 지도가 맡은 질문이다.
   */
  namedCodes?: string[];
  className?: string;
}

/**
 * 전체 지도.
 *
 * 메인 지도가 지금 묻는 곳으로 당겨지면서 잃는 것이 하나 있다 — 전체 안에서
 * 여기가 어디인가. 그 맥락이 없으면 확대된 모양만 보고 맞히는 도형 퀴즈가
 * 된다. 이 작은 지도가 그 자리를 지킨다.
 *
 * 그래서 여기서는 이름도 경계선도 필요 없다. 필요한 것은 실루엣과 점 하나다.
 */
export const MiniMap = memo(function MiniMap({
  geo,
  currentCode,
  passedCodes = EMPTY,
  namedCodes = EMPTY,
  className,
}: MiniMapProps) {
  const passed = useMemo(() => new Set(passedCodes), [passedCodes]);
  const justPassed = passedCodes[passedCodes.length - 1];
  /** 표시점은 본체에 찍는다. 섬까지 감싸면 점이 바다에 뜬다. */
  const dotAt = useCallback(
    (code: string | undefined) => {
      const region = code ? geo.regions.find((r) => r.code === code) : undefined;
      if (!region) return null;
      const box = mainPathBox(region.d);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    },
    [geo],
  );
  const marker = useMemo(() => dotAt(currentCode), [dotAt, currentCode]);
  const named = useMemo(
    () =>
      namedCodes
        .map((code) => ({ code, at: dotAt(code) }))
        .filter((n): n is { code: string; at: { x: number; y: number } } => !!n.at),
    [dotAt, namedCodes],
  );

  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      className={className}
      role="img"
      aria-label="전체 지도에서의 위치"
    >
      {geo.regions.map((r) => (
        <path
          key={r.code === justPassed ? `pass-${r.code}` : r.code}
          d={r.d}
          /*
           * 배경보다 확실히 어두워야 한다. 큰 지도에서 쓰는 회색을 그대로
           * 쓰면 이 크기에서는 배경에 묻혀 아무것도 안 보인다.
           */
          fill={passed.has(r.code) ? "var(--color-sign)" : "var(--color-concrete-deep)"}
          className={
            r.code === justPassed ? "map-pass" : "transition-[fill] duration-200"
          }
        />
      ))}

      {/*
        틀리게 부른 곳. 지금 묻는 곳보다 먼저 그린다 — 겹치면 위에 있어야 할
        것은 문제이지 오답이 아니다. 점을 조금 작게 두어 둘이 구별된다.
      */}
      {named.map((n) => (
        <circle
          key={n.code}
          cx={n.at.x}
          cy={n.at.y}
          r={Math.max(geo.width, geo.height) * 0.045}
          fill="var(--color-alert)"
          stroke="var(--color-paint)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/*
        지금 묻는 곳은 칠하지 않고 점으로 찍는다. 이 크기에서 작은 구를 칠해
        봐야 보이지 않고, 칠하면 "맞힌 곳"과 헷갈린다.
      */}
      {marker && (
        <g
          /*
             표시점도 같은 규칙으로 움직인다 — 큰 지도와 따로 놀면 두 지도가
             다른 순간을 가리킨다. CSS 속성으로 거는 이유는 RegionMap과 같다.
          */
          style={{
            transition: "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            transformBox: "view-box",
            transformOrigin: "0 0",
            transform: `translate(${marker.x}px, ${marker.y}px)`,
          }}
        >
          {/*
            큰 지도와 같은 색이어야 한다. 두 지도가 같은 순간을 가리키면서 다른
            말을 하면 안 된다 — 노랑이던 때가 있었고 파랑이던 때가 있었다.
          */}
          <circle
            r={Math.max(geo.width, geo.height) * 0.06}
            fill="var(--color-sign-hi)"
          />
          <circle
            r={Math.max(geo.width, geo.height) * 0.06}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  );
});

const EMPTY: string[] = [];

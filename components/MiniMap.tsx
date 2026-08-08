"use client";

import { memo, useMemo } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { mainPathBox } from "@/lib/geo/bbox";

interface MiniMapProps {
  geo: CourseGeo;
  currentCode?: string;
  passedCodes?: string[];
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
  className,
}: MiniMapProps) {
  const passed = useMemo(() => new Set(passedCodes), [passedCodes]);
  const justPassed = passedCodes[passedCodes.length - 1];
  const marker = useMemo(() => {
    const region = geo.regions.find((r) => r.code === currentCode);
    if (!region) return null;
    // 표시점도 본체에 찍어야 한다. 섬까지 감싸면 점이 바다에 뜬다.
    const box = mainPathBox(region.d);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }, [geo, currentCode]);

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
        지금 묻는 곳은 칠하지 않고 점으로 찍는다. 이 크기에서 작은 구를 칠해
        봐야 보이지 않고, 칠하면 "맞힌 곳"과 헷갈린다.
      */}
      {marker && (
        <g
          style={{ transition: "transform 600ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
          transform={`translate(${marker.x} ${marker.y})`}
        >
          <circle r={Math.max(geo.width, geo.height) * 0.045} fill="var(--color-centerline)" />
          <circle
            r={Math.max(geo.width, geo.height) * 0.045}
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

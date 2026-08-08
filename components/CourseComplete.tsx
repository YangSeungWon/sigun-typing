"use client";

import type { CourseGeo } from "@/data/geo/types";
import { RegionMap } from "./RegionMap";
import { formatClock } from "./Odometer";

interface CourseCompleteProps {
  courseName: string;
  total: number;
  placeUnit: string;
  elapsedMs: number;
  geo?: CourseGeo | null;
  passedCodes: string[];
}

/**
 * 다 채운 순간.
 *
 * 마지막 한 곳을 맞히자마자 결과 숫자로 넘어가면, 이 게임에서 가장 중요한
 * 순간이 그냥 지나간다. 완성된 지도를 눈으로 볼 시간을 주고 나서 기록을
 * 보여 준다.
 *
 * 색종이를 뿌리지 않는다. 이 게임의 축하는 지도가 다 칠해지는 것 자체이고,
 * 그건 다른 어떤 게임도 대신할 수 없는 그림이다.
 */
export function CourseComplete({
  courseName,
  total,
  placeUnit,
  elapsedMs,
  geo,
  passedCodes,
}: CourseCompleteProps) {
  return (
    <div className="course-done flex flex-col items-center gap-6 text-center">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-sm tracking-[0.28em] text-sign uppercase">
          완성
        </p>
        <p className="text-3xl font-bold sm:text-4xl">
          {courseName} {total}
          {placeUnit === "시도" ? "곳" : ` ${placeUnit}`} 전부
        </p>
        <p className="font-mono text-2xl tabular-nums text-dim">
          {formatClock(elapsedMs)}
        </p>
      </div>

      {geo && (
        <RegionMap
          geo={geo}
          passedCodes={passedCodes}
          variant="route"
          className="h-56 w-auto sm:h-72"
        />
      )}
    </div>
  );
}

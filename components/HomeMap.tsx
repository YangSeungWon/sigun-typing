"use client";

import { useMemo } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { getCourse } from "@/data/courses";
import { loadMistakes } from "@/lib/score/mistakes";
import { loadPersonalBest } from "@/lib/score/personalBest";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { RegionMap } from "./RegionMap";

interface HomeMapProps {
  geo: CourseGeo;
  courseId: string;
}

/**
 * 홈 지도에 내 상태를 얹는다.
 *
 * "내가 대한민국을 얼마나 알고 있는가"가 이 서비스의 progression이고, 그건
 * 지도 자체에 드러날 때 가장 잘 읽힌다. 그래서 따로 대시보드를 만들지 않고
 * 이미 있는 홈 지도에 색만 얹는다.
 *
 * 어떻게 아는가: 어느 지역을 맞혔는지 따로 저장하지 않는다. 대신 해 본
 * 코스에서 헷갈리는 목록에 없는 곳은 언젠가 맞힌 곳으로 본다. 완벽한 추론은
 * 아니지만, 이 화면이 답하려는 질문("어디가 남았나")에는 충분하다. 이걸
 * 정확히 하려고 지역마다 정답 이력을 쌓기 시작하면 기기에 남는 것만 늘어난다.
 *
 * 하이드레이션 전에는 서버와 같은 회색 지도를 그린다. 기록은 기기에만 있다.
 */
export function HomeMap({ geo, courseId }: HomeMapProps) {
  const hydrated = useIsHydrated();

  const { known, confusing } = useMemo(() => {
    if (!hydrated) return { known: EMPTY, confusing: EMPTY };

    const course = getCourse(courseId);
    const stuck = new Set(loadMistakes(courseId).map((r) => r.code));

    // 이 코스를 해 본 적이 있는가. 기록이 있거나, 틀린 곳이 남아 있으면 그렇다.
    const played =
      stuck.size > 0 ||
      (course
        ? ["map", "timeattack", "learn", "test"].some((mode) =>
            loadPersonalBest(courseId, mode as never, course.version),
          )
        : false);

    if (!played) return { known: EMPTY, confusing: EMPTY };

    return {
      known: geo.regions.map((r) => r.code).filter((code) => !stuck.has(code)),
      confusing: [...stuck],
    };
  }, [hydrated, courseId, geo]);

  return (
    <div className="flex flex-col items-center gap-2">
      <RegionMap
        geo={geo}
        passedCodes={known}
        missedCodes={confusing}
        variant="route"
        className="h-52 w-auto sm:h-64"
      />
      {known.length > 0 && (
        <p className="font-mono text-sm text-dim">
          {geo.regions.length}곳 중 <span className="text-sign">{known.length}곳</span>{" "}
          익힘
          {confusing.length > 0 && ` · ${confusing.length}곳 헷갈림`}
        </p>
      )}
    </div>
  );
}

const EMPTY: string[] = [];

import { memo } from "react";
import type { CourseGeo } from "@/data/geo/types";
import type { SidoProgress } from "@/lib/home/conquest";

interface NationalMapProps {
  geo: CourseGeo;
  /** 시도 코드 → 진행. 하이드레이션 전에는 비어 있다. */
  progress: Map<string, SidoProgress>;
  className?: string;
}

/**
 * 채워 가는 대한민국.
 *
 * 첫 화면이 목록이 아니라 상태판이 되는 이유의 절반이 이 그림이다. `82 / 245`는
 * 읽어야 알지만 이건 보면 안다 — 어디가 비었는지까지.
 *
 * 색조는 하나다. 시도마다 다른 색을 주면 지도가 알록달록해지면서 "얼마나
 * 채웠나"가 아니라 "무슨 색이 무슨 뜻인가"를 먼저 묻게 되고, 이 사이트가
 * 쓰는 도로표지판 언어(초록 = 지나온 땅)도 함께 깨진다. 진하기만 바꾼다.
 *
 * 하이드레이션 전에는 아무 색도 없다. 기록은 이 기기에만 있어서 서버가 알 수
 * 없고, 서버가 모르는 것을 미리 칠했다가 고치면 그게 불일치다. 이 앱은 이미
 * 같은 규칙으로 돈다 — 코스 지도와 목록 카드 둘 다 "첫 방문자의 지도는 색이
 * 없어야 한다"는 이유로 하이드레이션 뒤에 칠한다.
 */
export const NationalMap = memo(function NationalMap({
  geo,
  progress,
  className,
}: NationalMapProps) {
  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      preserveAspectRatio="xMidYMid meet"
      className={`home-map h-auto w-full ${className ?? ""}`}
      role="img"
      aria-label="대한민국 시도별 진행"
    >
      {geo.regions.map((region) => {
        const ratio = (progress.get(region.code)?.percent ?? 0) / 100;
        return (
          <path
            key={region.code}
            d={region.d}
            /*
             * 안 해 본 곳은 회색, 해 본 곳은 비율만큼 진한 초록. 0.12에서
             * 출발하는 이유는 한 곳만 아는 시도가 배경과 구별되어야 하기
             * 때문이다 — 0에서 시작하면 그 사람에게는 아무 일도 안 일어난다.
             */
            fill={ratio > 0 ? "var(--color-sign)" : "var(--color-map-idle)"}
            fillOpacity={ratio > 0 ? 0.12 + 0.88 * ratio : 1}
            stroke="var(--color-map-line)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            className="transition-[fill-opacity] duration-500"
          />
        );
      })}

      {/*
        지명은 적지 않는다.

        열일곱 개를 한 번에 얹어 봤다. 광역시는 자기를 감싼 도 안에 있어서
        `인천·서울`, `충남·대전`, `광주·전남`이 글자째 겹친다. 좁은 화면만
        문제인 줄 알았는데 1280px에서도 겹쳤다 — 위치가 겹치는 것이지 자리가
        좁은 것이 아니기 때문이다.

        겹침을 피하려고 라벨을 밀어내는 방법도 있지만, 그 전에 이 지도가 하는
        말이 무엇인지를 보면 답이 나온다. **어디가 비었나**이지 여기가 충북이다가
        아니다. 이름이 필요한 사람에게는 옆 정복도 카드가 시도 이름을 적어 준다.
        코스 지도가 한 번에 한 곳만 이름을 띄우는 것도 같은 이유다.
      */}
    </svg>
  );
});

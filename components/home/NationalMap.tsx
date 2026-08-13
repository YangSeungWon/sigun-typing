"use client";

import { memo, useMemo } from "react";
import type { CourseGeo } from "@/data/geo/types";

/** 지도 한 조각이 알아야 하는 것 전부. 이 컴포넌트는 코스 데이터를 모른다. */
export interface MapRegion {
  code: string;
  /** 시도 이름. `전북` */
  name: string;
  /**
   * 이 시도의 시군 코스. 세종에는 없다 —
   * 시도이면서 그 아래 시군이 없는 유일한 곳이라 고를 것이 없다.
   */
  courseId?: string;
  /** 고를 수 있을 때 읽어 줄 코스 이름. `전북 14 시군` */
  courseName?: string;
  known: number;
  total: number;
  percent: number;
}

interface NationalMapProps {
  geo: CourseGeo;
  /** 시도 코드 → 그 시도의 상태. 하이드레이션 전에는 진행이 전부 0이다. */
  regions: Map<string, MapRegion>;
  selectedCode: string | null;
  /** 같은 곳을 다시 누르면 null이 온다. */
  onSelect: (code: string | null) => void;
  /**
   * 지금 손이 얹힌 곳. 지도 밖(옆 목록)에서 올 수도 있다.
   *
   * 손이 얹혔다는 것을 CSS :hover로만 두지 않는 이유: 목록과 지도가 같은
   * 선택을 가리키는데 손 얹힘은 각자만 알면, 목록에서 `전북`을 짚어도 지도는
   * 아무 말이 없다. 지리 게임에서 그건 공짜로 가르칠 수 있는 것을 버리는 것이다.
   */
  hoveredCode: string | null;
  onHover: (code: string | null) => void;
  className?: string;
}

/**
 * 채워 가는 대한민국, 그리고 고르는 지도.
 *
 * 첫 화면이 목록이 아니라 상태판이 되는 이유의 절반이 이 그림이다. `82 / 245`는
 * 읽어야 알지만 이건 보면 안다 — 어디가 비었는지까지.
 *
 * 그런데 보기만 하는 그림이면 첫 화면에서 가장 큰 자리를 차지할 이유가 약하다.
 * 비어 있는 곳이 눈에 띄었는데 거기서 할 수 있는 일이 없으면, 결국 목록으로
 * 가서 이름으로 다시 찾아야 한다. **눈에 띈 자리에서 바로 시작할 수 있어야**
 * 지도가 제 몫을 한다. 그래서 누르면 그 코스가 아래 버튼에 걸린다.
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
  regions,
  selectedCode,
  onSelect,
  hoveredCode,
  onHover,
  className,
}: NationalMapProps) {
  /*
   * 강조된 조각을 맨 나중에 그린다.
   *
   * SVG는 나중에 그린 것이 위에 온다. 원래 순서대로 두면 서울에 손을 올려도
   * 뒤에 오는 경기가 자기 흰 경계선을 그 위에 덧그려, 검은 테두리가 맞닿은
   * 쪽부터 잘려 나간다.
   *
   * 테두리만 따로 위에 얹는 방법도 있지만 그러면 키보드 포커스 표시가 같은
   * 문제를 그대로 안는다. 순서를 바꾸면 셋(고름·손 얹힘·포커스)이 한 번에
   * 풀린다. 자리만 옮기는 것이라 React가 노드를 새로 만들지 않으므로
   * 포커스도 따라 움직인다.
   */
  const ordered = useMemo(() => {
    const lift = (code: string) =>
      code === selectedCode ? 2 : code === hoveredCode ? 1 : 0;
    // 정렬은 안정적이라 나머지 조각의 순서는 그대로다.
    return [...geo.regions].sort((a, b) => lift(a.code) - lift(b.code));
  }, [geo.regions, selectedCode, hoveredCode]);

  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      preserveAspectRatio="xMidYMid meet"
      className={`home-map h-auto w-full ${className ?? ""}`}
      /*
       * role="img"를 걷었다. 누를 수 있는 것들이 안에 들어 있는데 하나의
       * 그림이라고 말해 버리면 보조기술이 그 안을 아예 안 읽는다.
       */
      role="group"
      aria-label="시도 고르기"
    >
      {ordered.map((shape) => {
        const region = regions.get(shape.code);
        const ratio = (region?.percent ?? 0) / 100;
        const selected = shape.code === selectedCode;
        const hovered = shape.code === hoveredCode;
        const selectable = Boolean(region?.courseId);

        /*
         * 고를 수 없는 곳은 옅게 그린다.
         *
         * 세종 하나뿐이다. 시도이면서 그 아래 시군이 없어 코스가 없는데,
         * 다른 시도와 똑같은 회색으로 그려 놓으니 **아직 안 해 본 곳처럼**
         * 보였다. 눌러도 아무 일이 없으니 고장으로 읽힌다.
         *
         * 바탕 쪽으로 한 단계 물려 "여기는 칠할 수 있는 칸이 아니다"를
         * 보이게 한다. 지우지는 않는다 — 없으면 지도에 구멍이 뚫린다.
         *
         * 왜인지를 <title>로 덧붙였다가 걷었다. React 19는 <title>을 문서
         * 제목으로 다뤄 서버 렌더에서 걷어내는데 클라이언트에서는 그리므로,
         * 그 한 줄 때문에 첫 화면 전체가 하이드레이션 불일치로 다시 그려졌다.
         * 도구 설명 하나와 바꿀 값이 아니다 — 옅게 그린 것만으로 충분하다.
         */
        const fill = !selectable
          ? { fill: "var(--color-map-idle)", fillOpacity: 0.3 }
          : ratio > 0
            ? { fill: "var(--color-sign)", fillOpacity: 0.12 + 0.88 * ratio }
            : { fill: "var(--color-map-idle)", fillOpacity: 1 };

        return (
          <path
            key={shape.code}
            d={shape.d}
            {...fill}
            /*
             * 고른 곳은 테두리로 표시한다. 채우기로 표시하면 "얼마나 아는가"를
             * 말하던 색이 "지금 고른 곳"까지 겸하게 되어 둘 다 안 읽힌다.
             */
            /*
             * 고른 곳과 손 얹힌 곳은 굵기로 갈린다.
             *
             * 손 얹힘을 선택과 똑같이 그리면, 부산을 골라 둔 채 경기에 손을
             * 올렸을 때 둘 다 골라진 것처럼 보인다. 지금 무엇이 골라져 있는지가
             * 사라지는 셈이다. 손 얹힘은 "여기를 가리키는 중"이고 선택은
             * "이걸 골랐다"라, 같은 색이되 무게가 달라야 한다.
             */
            stroke={selected || hovered ? "var(--color-ink)" : "var(--color-map-line)"}
            strokeWidth={selected ? 3 : hovered ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            {...(selectable
              ? {
                  /*
                   * SVG 도형은 button이 될 수 없다. 역할과 키보드 조작을 손으로
                   * 달아 준다 — 누를 수 있게 만들어 놓고 마우스로만 되게 두면
                   * 지도에 있는 코스는 키보드로 영영 고를 수 없다.
                   */
                  role: "button",
                  tabIndex: 0,
                  "aria-pressed": selected,
                  "aria-label": `${region!.courseName}, ${region!.known} / ${region!.total}`,
                  onClick: () => onSelect(selected ? null : shape.code),
                  onMouseEnter: () => onHover(shape.code),
                  onMouseLeave: () => onHover(null),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault(); // 스페이스가 화면을 굴리지 않게
                    onSelect(selected ? null : shape.code);
                  },
                  /*
                   * 포커스를 outline으로 그리지 않는다.
                   *
                   * outline은 도형이 아니라 그 **바깥 상자**에 그려진다. 지도
                   * 가장자리의 시도(강원·제주)에서는 그 상자가 viewBox 밖으로
                   * 나가 잘리면서, 지도를 가로지르는 직선 몇 개만 남는다.
                   *
                   * 대신 테두리를 쓴다. 고른 곳은 굵은 실선, 포커스는 점선 —
                   * 둘 다 "여기"를 뜻하지만 하나는 머무는 상태고 하나는
                   * 지나가는 상태라 구별되어야 한다.
                   */
                  className:
                    "cursor-pointer transition-[fill-opacity,stroke-width] duration-200 focus:outline-none focus-visible:[stroke-dasharray:6_4] focus-visible:[stroke-width:3] focus-visible:[stroke:var(--color-ink)]",
                }
              : {
                  // 세종. 그릴 것은 있고 고를 것은 없다.
                  className: "transition-[fill-opacity] duration-500",
                })}
          />
        );
      })}

      {/*
        지명은 적지 않는다.

        열일곱 개를 한 번에 얹어 봤다. 광역시는 자기를 감싼 도 안에 있어서
        `인천·서울`, `충남·대전`, `광주·전남`이 글자째 겹친다. 좁은 화면만
        문제인 줄 알았는데 1280px에서도 겹쳤다 — 위치가 겹치는 것이지 자리가
        좁은 것이 아니기 때문이다.

        누를 수 있게 된 지금도 그대로 둔다. 어디를 골랐는지는 지도 아래 줄이
        이름으로 말해 주므로, 열일곱 개를 미리 다 적어 둘 이유가 없다.
      */}
    </svg>
  );
});

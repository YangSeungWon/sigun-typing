"use client";

import { memo, useMemo, useState, type CSSProperties } from "react";
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
  /**
   * 짚으면 이름이 뜨는 지도.
   *
   * 코스를 고르는 화면에서 "이 모양이 어디지"를 손으로 확인하는 자리다.
   * 지도책을 짚어 보는 동작이고, 이 게임이 가르치려는 것과 같은 방향이다.
   *
   * **문제를 내는 지도에서는 절대 켜지 않는다** — 거기서 이름은 곧 답이다.
   * 그래서 아래에서 variant까지 함께 본다. 실수로 넘겨도 켜지지 않는다.
   */
  explore?: boolean;
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
  explore = false,
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
  /*
   * 라벨 글자 크기. 지도마다 viewBox가 다르므로 비율로 잡는다 —
   * 고정값으로 두면 서울에서 알맞은 크기가 전국 지도에서는 깨알이 된다.
   */
  const fontSize = Math.round(geo.width * 0.055);

  const transform = useMemo(
    () => (focus ? focusTransform(camera, geo) : ""),
    [focus, camera, geo],
  );
  /** 모든 경계를 이어 붙인 한 장. 각 조각이 `M`으로 시작하므로 그대로 이으면 된다. */
  const silhouette = useMemo(() => geo.regions.map((r) => r.d).join(""), [geo]);

  /*
   * 짚어 보는 지도.
   *
   * 문제를 내는 지도(hint)에서는 어떤 경우에도 켜지지 않는다. 이름을 띄우는
   * 순간 그게 답이기 때문이다 — 넘겨받은 값과 지도의 성격을 함께 본다.
   */
  const explorable = explore && variant === "route";
  /**
   * 짚는 것과 고르는 것은 다르다.
   *
   * 손이 지나가는 동안에만 이름이 뜨면, 다른 곳을 보려고 손을 옮기는 순간
   * 사라져 두 지역을 견주지 못한다. 눌러 두면 남는다 — 지도책에 손가락을
   * 얹어 두는 것과 같다. 같은 곳을 다시 누르거나 바깥을 누르면 놓는다.
   */
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked ?? hovered;
  const label = useMemo(
    () => geo.regions.find((r) => r.code === active),
    [geo, active],
  );

  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      className={className}
      role="img"
      onPointerLeave={explorable ? () => setHovered(null) : undefined}
      // 지도 바깥(바다)을 누르면 놓는다.
      onClick={
        explorable
          ? (e) => {
              if (e.target === e.currentTarget) setPicked(null);
            }
          : undefined
      }
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
        style={{ ...PAN, transform }}
      >
        {/*
          지역들을 한 장으로 합친 실루엣을 맨 아래에 깐다.
          경계를 각각 그리면 인접한 두 면 사이로 배경이 실처럼 비친다 —
          단순화된 좌표가 미세하게 어긋나서이기도 하고, 두 면을 따로
          안티앨리어싱하면서 생기는 틈이기도 하다. 지도에 구멍이 난 것처럼
          보이는 쪽이 문제이므로, 그 자리에 배경 대신 지도색이 오게 한다.
        */}
        <path d={silhouette} fill="var(--color-map-idle)" />

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
              /*
               * 주변 경계는 지도를 읽는 데 필요한 만큼만.
               * 2px 흰 선으로 다 두르면 지도가 아니라 퍼즐판으로 읽히고,
               * 지금 묻는 곳의 검은 테두리와 세기를 다투게 된다. 강조는
               * 타깃 하나가 독점해야 한다.
               */
              stroke="var(--color-map-line)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              // 확대해도 경계선 두께는 그대로여야 지도가 뭉개지지 않는다.
              vectorEffect={focus ? "non-scaling-stroke" : undefined}
              /*
               * key를 바꿔 요소를 다시 붙이는 것으로 애니메이션을 재생한다.
               * 클래스를 껐다 켜는 방식보다 어긋날 여지가 없다.
               */
              key={r.code === justPassed ? `pass-${r.code}` : r.code}
              onPointerEnter={explorable ? () => setHovered(r.code) : undefined}
              onPointerLeave={
                explorable ? () => setHovered((c) => (c === r.code ? null : c)) : undefined
              }
              onClick={
                explorable
                  ? () => setPicked((c) => (c === r.code ? null : r.code))
                  : undefined
              }
              style={explorable ? { cursor: "pointer" } : undefined}
              className={
                r.code === justPassed
                  ? "map-pass"
                  : /*
                     * 지금 묻는 곳만은 색이 **즉시** 바뀐다. 카메라가 미끄러지는
                     * 동안 어디로 가는지가 이미 보여야, 이동이 화면 전환이
                     * 아니라 시선 이동으로 읽힌다.
                     */
                    isCurrent
                    ? undefined
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
        <g aria-hidden="true" style={{ ...PAN, transform }}>
          {geo.regions
            .filter((r) => missed.has(r.code))
            .map((r) => (
              <path key={r.code} d={r.d} fill="url(#missed-hatch)" />
            ))}
        </g>
      )}

      {/*
        짚은 곳을 한 번 감싼다. 이름만 띄우면 판이 어느 도형의 것인지 눈으로
        잇지 못한다 — 지금 묻는 곳을 감싸는 것과 같은 테두리를 쓴다.

        눌러서 고른 곳은 한 겹 더 눌러 앉힌다. 색을 바꾸지 않고 어둡게만
        덮는 이유: 초록(아는 곳)과 빨강(헷갈리는 곳)이 이 화면에서 뜻을
        가지므로, 고른다고 그 뜻이 달라지면 안 된다.
      */}
      {explorable && label && (
        <>
          {picked === label.code && (
            <path
              d={label.d}
              fill="var(--color-ink)"
              opacity={0.14}
              pointerEvents="none"
            />
          )}
          <path
            d={label.d}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={3}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </>
      )}

      {/*
        짚은 곳의 이름.

        도로표지 그대로 — 초록 판에 흰 글자다. 지도 위에 뜨는 이름이 이 사이트
        어디에서나 같은 모양이어야 "저건 지명이다"가 설명 없이 읽힌다.
        판은 지역 위에 뜨고, 위쪽 가장자리에서는 아래로 내려 붙는다.
      */}
      {explorable && label && (
        <g className="region-label" pointerEvents="none">
          <rect
            x={Math.min(
              Math.max(label.cx - plateWidth(label.name, fontSize) / 2, 4),
              geo.width - plateWidth(label.name, fontSize) - 4,
            )}
            y={label.cy - fontSize * 2.4 < 4 ? label.cy + fontSize * 0.7 : label.cy - fontSize * 2.4}
            width={plateWidth(label.name, fontSize)}
            height={fontSize * 1.7}
            rx={fontSize * 0.25}
            fill="var(--color-sign)"
          />
          <text
            x={Math.min(
              Math.max(label.cx, 4 + plateWidth(label.name, fontSize) / 2),
              geo.width - plateWidth(label.name, fontSize) / 2 - 4,
            )}
            y={
              (label.cy - fontSize * 2.4 < 4
                ? label.cy + fontSize * 0.7
                : label.cy - fontSize * 2.4) +
              fontSize * 0.85
            }
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight={700}
            fill="var(--color-paint)"
          >
            {label.name}
          </text>
        </g>
      )}

      {currentCode && (
        <path
          // 테두리도 함께 움직여야 한다.
          style={{ ...PAN, transform }}
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

/**
 * 지명 판의 폭. 한글은 글자 하나가 거의 정사각형이라 글자 수로 잡으면 맞는다.
 * 재 보지 않고 계산으로 두는 이유: SVG에서 글자 폭을 재려면 그린 뒤에 읽어야
 * 하고, 그러면 판이 한 프레임 늦게 따라붙는다.
 */
function plateWidth(name: string, fontSize: number): number {
  return [...name].length * fontSize * 1.02 + fontSize * 0.9;
}

/**
 * 카메라가 다음 지역으로 옮겨 가는 동안.
 *
 * 확대된 상태에서 문제가 바뀌면 화면이 통째로 다른 곳을 비추게 된다. 그것이
 * 한 프레임에 끝나면 지도가 이어진 공간이 아니라 슬라이드 두 장으로 읽힌다 —
 * 방금 본 지역 옆이 어디인지가 이 게임의 실마리인데, 그 연결이 끊긴다.
 *
 * 그래서 미끄러지되 **빠르게**. 600ms는 다음 문제를 읽으려는 손을 기다리게
 * 했다. 어디로 가는지는 이미 알고 있으므로(노랑은 이동 전에 이미 켜진다)
 * 이동 자체는 눈이 따라올 최소한이면 된다.
 *
 * transform-box·origin을 함께 주는 이유는 lib/geo/bbox.ts의 focusTransform에
 * 적어 두었다 — SVG 속성과 같은 좌표계를 만들기 위한 것이다.
 */
const PAN: CSSProperties = {
  transition: "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
  transformBox: "view-box",
  transformOrigin: "0 0",
};

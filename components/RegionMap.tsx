"use client";

import { memo, useId, useMemo, useState, type CSSProperties } from "react";
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
  /**
   * 맞히긴 했지만 헤맨 곳 — 초성을 봤거나, 틀렸다 고쳤거나.
   *
   * `passedCodes`에도 들어 있다. 여기 있으면 그 위에 색이 덮인다.
   */
  struggledCodes?: string[];
  /**
   * 이번 문제에서 **틀리게 부른 곳들.** 순서가 의미를 가진다 — 마지막 것에만
   * 이름표가 붙는다.
   *
   * 답이 아니라 오답의 자리다. `안산시`라고 답했으면 안산시를 켠다. 정답은
   * 그대로 감춘 채, 사람이 자기가 부른 이름이 어디인지 보고 다음 추측을
   * 좁히게 하는 장치다. 그래서 문제를 내는 지도(hint)에서도 켤 수 있다 —
   * 이름표가 뜨지만 그건 **그 사람이 친 이름**이라 답을 흘리지 않는다.
   */
  namedCodes?: string[];
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
  struggledCodes = EMPTY,
  namedCodes = EMPTY,
  variant,
  focus = false,
  explore = false,
  className,
}: RegionMapProps) {
  const passed = useMemo(() => new Set(passedCodes), [passedCodes]);
  const missed = useMemo(() => new Set(missedCodes), [missedCodes]);
  const struggled = useMemo(() => new Set(struggledCodes), [struggledCodes]);
  const named = useMemo(() => new Set(namedCodes), [namedCodes]);
  /** 이름표는 마지막에 부른 곳에만. 다섯 번 틀리면 판이 다섯 장 겹친다. */
  const lastNamed = useMemo(
    () => geo.regions.find((r) => r.code === namedCodes[namedCodes.length - 1]),
    [geo, namedCodes],
  );
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
  /* 한 화면에 지도가 둘 이상 뜰 수 있다. clipPath id가 겹치면 서로를 자른다. */
  const clipId = useId();

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
          물길은 코스 실루엣 안에서만 보인다.

          강은 경계에서 끊기지 않으므로, 서울 지도에 한강을 얹으면 그 줄기가
          경기도까지 뻗어 화면 밖으로 나간다. 빌드에서 지리적으로 자르는
          방법도 있지만 강줄기를 다각형으로 오려 내는 일이라 값이 크다.
          여기서 실루엣으로 클립하면 정확하고 공짜다.
        */}
        {(geo.water || geo.terrain) && (
          <clipPath id={`${clipId}-land`}>
            <path d={silhouette} />
          </clipPath>
        )}
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
        {/*
          아직 안 간 곳의 바탕.
          판이 도는 동안에는 연하게 깐다. 진하게 두면 칠한 곳과 안 칠한 곳의
          명도가 비슷해져서, 지도가 "어디를 했고 어디가 남았나"를 말하지 않고
          그냥 회색 덩어리로 보인다. 끝난 뒤(explore)에는 되돌린다 — 거기서는
          짚어 보는 것이 일이라 바탕도 또렷해야 한다.
        */}
        <path
          d={silhouette}
          fill="var(--color-map-idle)"
          opacity={explore ? 1 : 0.55}
        />

        {/*
          고도 띠. 낮은 쪽부터 겹쳐 쌓아 높은 곳일수록 진해진다.

          땅 안에서만 보인다 — 등고선은 판 전체에 걸쳐 나오므로 자르지 않으면
          바다에까지 산이 걸린다.
        */}
        {geo.terrain && (
          <g
            className="pointer-events-none"
            clipPath={`url(#${clipId}-land)`}
            aria-hidden
          >
            {/*
              띠는 겹쳐 쌓인다. 위 띠는 아래 띠 안에 들어 있으므로 색이
              누적된다 — 넉 장이면 0.4씩 겹쳐 0.4 · 0.64 · 0.78 · 0.87이 된다.
              장수가 늘 때 한 장의 농도를 낮춰야 층계가 고르게 남는다.
            */}
            {geo.terrain.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="var(--color-relief)"
                opacity={explore ? 0.4 : 0.22}
              />
            ))}
          </g>
        )}

        {geo.regions.map((r) => {
          const isCurrent = r.code === currentCode;
          const isPassed = passed.has(r.code);
          const isMissed = missed.has(r.code);
          const isStruggled = struggled.has(r.code);
          return (
            <path
              d={r.d}
              /*
               * **색은 상태를, 밝기는 "지금"을 말한다.**
               *
               * 색을 넷으로 쓰다 막혔었다. 노랑이 "네가 답할 곳"이라 헤맨 곳에
               * 줄 색이 없었고, 현재 지역을 파랑으로 옮겨 봤더니 지도에 계열이
               * 다른 색이 하나 끼어 표지판 같지 않았다.
               *
               * 축을 나누면 풀린다. 초록·노랑·빨강은 **지나간 것들의 상태**이고
               * (한 번에·헤맴·못 맞힘), 지금 묻는 곳은 같은 초록 계열의 밝은
               * 쪽이다. 그리고 지나간 것들을 한 겹 물리면 밝은 것이 하나만 남는다.
               *
               * 두 모드가 여기서 합쳐진다. 이름을 보여 주는 모드는 원래 현재
               * 지역을 "곧 칠해질 곳"이라는 뜻의 밝은 초록으로 칠하고 있었고,
               * 문제를 내는 모드도 같은 색을 쓰게 됐다 — 뜻이 다르지 않다.
               */
              /*
               * 결과가 먼저다.
               *
               * `isCurrent`를 앞에 두었더니, 건너뛴 곳을 되짚어 주는 순간에
               * 그 곳이 밝은 초록으로 떴다 — 못 맞힌 곳이 맞힌 것처럼 읽힌다.
               * 현재 지역이 파랑이던 때는 안 드러나던 문제다. 지금 어디인지는
               * 카메라와 테두리가 이미 말하므로, 색은 결과를 말하게 둔다.
               *
               * 방금 맞힌 곳이 한 번 빛나는 것은 색이 아니라 `map-pass`
               * 애니메이션이 맡는다.
               */
              fill={
                isMissed
                  ? // 지나왔지만 못 맞힌 곳. 아직 안 간 회색과 구분돼야
                    // 지도만 보고도 어디를 다시 봐야 하는지 읽힌다.
                    "var(--color-alert)"
                  : isStruggled
                    ? "var(--color-centerline)"
                    : isPassed
                      ? "var(--color-sign)"
                      : isCurrent
                        ? "var(--color-sign-hi)"
                        : /*
                           * 아직 모르는 곳은 **비워 둔다.**
                           *
                           * 여기를 칠하면 밑에 깐 고도 띠가 통째로 덮인다. 비워
                           * 두면 지형이 그대로 드러나고, 맨 아래 실루엣이 지형
                           * 없는 저지대의 바탕을 맡는다.
                           */
                          "none"
              }
              /*
               * 색이 든 곳은 반투명으로 덮는다.
               *
               * 지형을 완전히 가리면 아는 곳만 평평해져서, 지도를 채울수록
               * 지형이 사라진다. 살짝 비치게 두면 맞힌 뒤에도 그 땅이 어떤
               * 땅인지가 남는다.
               *
               * 판이 도는 동안에는 **지나간 것들만 한 겹 더 물린다.** 밝은 것이
               * 화면에 하나만 남아야 눈이 지금 묻는 곳으로 간다 — 색이 아니라
               * 밝기가 "지금"을 말하는 구조다. 끝난 뒤에는 되돌린다. 거기서는
               * 지나간 것들이 곧 결과다.
               */
              opacity={
                isCurrent || isPassed || isMissed || isStruggled
                  ? explore || isCurrent
                    ? 0.82
                    : 0.5
                  : 1
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
                explorable
                  ? () => setHovered((c) => (c === r.code ? null : c))
                  : undefined
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

        {/*
          물길은 **지역 색 위**에 얹는다.

          아래 두어 봤더니 언제나 안 보였다 — 지역은 불투명하게 칠해지므로
          그 밑에 무엇을 그리든 덮인다. 위에 얹되 강은 가늘어서 맞힌 곳의
          초록을 가리지 않는다.

          땅 밖으로는 안 나간다. 강은 경계에서 끊기지 않으므로 서울 지도에
          한강을 얹으면 줄기가 경기도까지 뻗는다.
        */}
        {geo.water && (
          <g
            className="pointer-events-none"
            clipPath={`url(#${clipId}-land)`}
            aria-hidden
          >
            <path d={geo.water.areas} fill="var(--color-water)" />
            <path
              d={geo.water.lines}
              fill="none"
              stroke="var(--color-water)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
      </g>

      {/*
        틀리게 부른 곳의 테두리.
        **칠하지 않고 두른다.** 채우기는 이미 네 가지 뜻을 지고 있고(한 번에·
        헤맴·못 맞힘·지금 문제), 여기에 다섯 번째를 얹으면 지도가 범례를
        요구하게 된다. 테두리는 그 위에 겹쳐도 아래 상태를 안 가린다 —
        "이 곳이 무엇인가"가 아니라 "네가 방금 여기를 불렀다"이므로 층이 다르다.
      */}
      {namedCodes.length > 0 && (
        <g style={{ ...PAN, transform }} pointerEvents="none" aria-hidden>
          {geo.regions
            .filter((r) => named.has(r.code))
            .map((r) => (
              <path
                key={r.code}
                d={r.d}
                fill="none"
                stroke="var(--color-alert)"
                strokeWidth={3}
                strokeDasharray="8 6"
                strokeLinejoin="round"
              />
            ))}
        </g>
      )}

      {/*
        현재 지역을 한 번 더 감싼다. 전국 지도에서 서울처럼 작은 지역은
        채우기만으로는 눈에 띄지 않는다. 이름은 쓰지 않는다 — 그게 문제니까.
      */}
      {/*
        색 위에 얹는 빗금. 채우기와 별개의 층이라 색을 가리지 않는다.

        포인터는 통과시킨다. 장식인데 클릭을 먹고 있어서, 못 맞힌 곳(빨강)만
        짚어도 이름이 뜨지 않고 눌리지도 않았다.
      */}
      {/*
        비어 있어도 자리를 지운다.

        조건을 걸어 두면 첫 오답이 났을 때 이 층이 **새로 태어난다.** CSS
        트랜지션은 갓 붙은 요소를 움직여 주지 않으므로, 그 순간 빗금만 목적지에
        뚝 나타나고 지도는 뒤따라 미끄러진다 — 두 겹이 따로 논다.
      */}
      <g
        aria-hidden="true"
        pointerEvents="none"
        style={{ ...PAN, transform }}
        // 채우기와 같은 만큼 물린다. 빗금만 진하면 못 맞힌 곳이 되레 튄다.
        opacity={explore ? 1 : 0.62}
      >
        {geo.regions
          .filter((r) => missed.has(r.code))
          .map((r) => (
            <path key={r.code} d={r.d} fill="url(#missed-hatch)" />
          ))}
      </g>

      {/*
        짚은 곳을 한 번 감싼다. 이름만 띄우면 판이 어느 도형의 것인지 눈으로
        잇지 못한다 — 지금 묻는 곳을 감싸는 것과 같은 테두리를 쓴다.

        짚기만 해도 한 겹 어두워지고, 눌러서 고르면 두 배로 어두워진다.
        손이 닿은 것과 얹어 둔 것은 다른 상태이므로 다르게 보여야 한다.

        색을 바꾸지 않고 어둡게만 덮는 이유: 초록(아는 곳)과 빨강(헷갈리는 곳)이
        이 화면에서 뜻을 가지므로, 짚거나 고른다고 그 뜻이 달라지면 안 된다.
      */}
      {explorable && label && (
        <>
          <path
            d={label.d}
            fill="var(--color-ink)"
            opacity={picked === label.code ? 0.14 : 0.06}
            pointerEvents="none"
          />
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
        <NamePlate region={label} fontSize={fontSize} mapWidth={geo.width} />
      )}

      {/*
        틀리게 부른 곳의 이름표. 자기가 친 이름이라 답을 흘리지 않는다.
        마지막 하나만 띄운다 — 여러 번 틀리면 판이 겹쳐 지도를 덮는다.

        팬 그룹 안에 넣는다. 위의 짚어 보기 이름표는 밖에 있어도 됐는데,
        그 지도는 카메라가 움직이지 않기 때문이다(`focus`가 꺼져 있다).
        게임 화면은 문제마다 미끄러지므로 밖에 두면 판만 제자리에 남는다.
      */}
      {lastNamed && (
        <g style={{ ...PAN, transform }} pointerEvents="none">
          <NamePlate region={lastNamed} fontSize={fontSize} mapWidth={geo.width} />
        </g>
      )}


      {/*
        테두리도 함께 움직여야 한다.

        `currentCode`가 있을 때만 그리게 두었더니, 카운트다운이 끝나는 순간
        지도와 따로 놀았다. 그때 한 렌더에서 두 가지가 동시에 뒤집힌다 —
        지도는 `focus`가 켜지며 320ms를 미끄러지는데, 테두리는 바로 그 렌더에
        처음 붙으므로 트랜지션할 이전 상태가 없어 목적지에 즉시 나타난다.

        그래서 지울 것은 요소가 아니라 **선**이다. 자리는 처음부터 지키고
        그릴 것이 없을 때는 `d`를 비운다. 그러면 카운트다운 동안에도 첫 지역이
        미리 드러나지 않으면서, 시작하는 순간 지도와 같은 곡선을 탄다.
      */}
      <path
        style={{ ...PAN, transform }}
        d={current?.d}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={4}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
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

/**
 * 지도 위의 지명 판.
 *
 * 도로표지 그대로 — 초록 판에 흰 글자다. 지도 위에 뜨는 이름이 이 사이트
 * 어디에서나 같은 모양이어야 "저건 지명이다"가 설명 없이 읽힌다.
 *
 * 판은 지역 위에 뜨고, 위쪽 가장자리에서는 아래로 내려 붙는다. 좌우로도
 * 화면을 벗어나지 않게 물린다 — 가장자리 지역의 이름이 잘리면 그건 이름표가
 * 아니다.
 *
 * 짚어 보는 지도와 오답을 짚어 주는 지도가 같은 판을 쓴다. 둘 다 "여기가
 * 어디인가"를 말하는 자리다.
 */
function NamePlate({
  region,
  fontSize,
  mapWidth,
}: {
  region: { name: string; cx: number; cy: number };
  fontSize: number;
  mapWidth: number;
}) {
  const width = plateWidth(region.name, fontSize);
  const above = region.cy - fontSize * 2.4 >= 4;
  const top = above ? region.cy - fontSize * 2.4 : region.cy + fontSize * 0.7;
  const left = Math.min(Math.max(region.cx - width / 2, 4), mapWidth - width - 4);

  return (
    <g className="region-label" pointerEvents="none">
      <rect
        x={left}
        y={top}
        width={width}
        height={fontSize * 1.7}
        rx={fontSize * 0.25}
        fill="var(--color-sign)"
      />
      <text
        x={left + width / 2}
        y={top + fontSize * 0.85}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={700}
        fill="var(--color-paint)"
      >
        {region.name}
      </text>
    </g>
  );
}

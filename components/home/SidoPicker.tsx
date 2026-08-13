"use client";

import type { MapRegion } from "./NationalMap";

interface SidoPickerProps {
  /** 지도와 같은 목록, 같은 순서. */
  regions: MapRegion[];
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
}

/**
 * 지도 옆의 목록.
 *
 * 지도만으로는 고를 수 없는 곳이 있다. 대전·광주·울산·세종은 화면에서 몇
 * 픽셀이고, 손가락은 그보다 굵다. 지도를 키우면 첫 화면이 지도 하나로 차고,
 * 안 키우면 못 누른다 — 지도 하나로 풀 수 있는 문제가 아니다.
 *
 * 그래서 같은 선택을 두 방식으로 준다. 지도는 **어디가 비었는지 보고** 고르는
 * 길이고, 목록은 **이름을 알고** 고르는 길이다. 둘은 같은 상태를 가리키므로
 * 한쪽에서 고르면 다른 쪽에도 표시된다.
 *
 * 넓은 화면에서는 지도 오른쪽에 세로로 서고, 좁은 화면에서는 지도 아래에
 * 이름만 남은 조각으로 흩어진다. 같은 DOM에 CSS만 다르다 — 화면마다 컴포넌트를
 * 따로 만들면 고르는 규칙이 두 벌이 된다.
 */
export function SidoPicker({ regions, selectedCode, onSelect }: SidoPickerProps) {
  return (
    <ul
      className="flex flex-wrap gap-1.5 lg:w-32 lg:flex-none lg:flex-col lg:flex-nowrap lg:gap-0.5"
      aria-label="시도 고르기"
    >
      {regions.map((region) => {
        const selected = region.code === selectedCode;
        return (
          <li key={region.code}>
            <button
              type="button"
              onClick={() => onSelect(selected ? null : region.code)}
              aria-pressed={selected}
              className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm lg:py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                selected
                  ? "bg-sign text-on-sign"
                  : "text-ink/80 hover:bg-concrete-deep hover:text-ink"
              }`}
            >
              <span>{region.name}</span>
              {/*
                숫자는 넓은 화면에서만. 좁은 화면에서는 이 목록이 세로줄이
                아니라 이름 조각들이라, 조각마다 분수를 달면 한 줄에 두 개밖에
                안 들어가고 열일곱 개가 화면을 반쯤 먹는다.
              */}
              <span
                className={`hidden font-mono text-xs tabular-nums lg:inline ${
                  selected ? "text-on-sign/80" : "text-dim"
                }`}
              >
                {region.known} / {region.total}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

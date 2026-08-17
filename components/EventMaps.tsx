export interface EventSide {
  year: string;
  regions: { code: string; name: string; d: string }[];
  marked: string[];
}

export interface HistoryEvent {
  /** 자료에 처음 나타난 해. 주소가 된다. */
  year: string;
  /** 크게 뜨는 해 — 실제로 그 일이 있었던 해. */
  at: string;
  /** 실제 날짜를 아는가. */
  dated: boolean;
  headline: string;
  before: EventSide;
  after: EventSide;
}

/**
 * 개편 하나의 전후 지도.
 *
 * 전국 타임랩스에서는 시군구 개편이 몇 픽셀이라 안 보인다. 그래서 여기서는
 * 그 일이 일어난 시도만 잘라 같은 투영으로 두 장을 나란히 놓는다 — 투영이
 * 같아야 무엇이 합쳐지고 갈라졌는지가 눈으로 겹쳐 읽힌다.
 *
 * 사라진 쪽과 생긴 쪽을 **다른 색으로** 칠한다. 같은 색으로 두면 두 지도가
 * 그냥 비슷한 그림 두 장이 된다.
 */
export function EventMaps({
  event,
  width,
  height,
}: {
  event: HistoryEvent;
  width: number;
  height: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {([event.before, event.after] as const).map((side, i) => {
        const gone = i === 0;
        return (
          <figure key={side.year} className="flex flex-col gap-1.5">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-auto w-full"
              role="img"
              aria-label={`${side.year}년 ${side.regions.length}곳`}
            >
              {side.regions.map((r) => {
                const hit = side.marked.includes(r.code);
                return (
                  <path
                    key={r.code}
                    d={r.d}
                    className={
                      hit
                        ? gone
                          ? "fill-[var(--color-alert)] stroke-[var(--color-map-line)]"
                          : "fill-[var(--color-sign)] stroke-[var(--color-map-line)]"
                        : "fill-[var(--color-map-idle)] stroke-[var(--color-map-line)]"
                    }
                    strokeWidth={0.8}
                  >
                    <title>{r.name}</title>
                  </path>
                );
              })}
            </svg>
            <figcaption className="flex items-baseline justify-between gap-2 font-mono text-sm tabular-nums text-dim">
              {side.year}
              <span className="text-xs">{side.regions.length}곳</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

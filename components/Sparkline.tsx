/**
 * 줄 하나.
 *
 * 축도 눈금도 없다. 이 그림이 답할 물음은 "내려가고 있는가" 하나이고, 그건 선의
 * 모양만으로 읽힌다 — 사람이 곡선에서 먼저 읽는 것은 숫자가 아니라 기울기다.
 *
 * 세로는 시간이고 **아래가 빠른 쪽**이다. 그래서 잘하고 있으면 선이 내려간다.
 * 가로는 판 순서지 날짜가 아니다. 날짜로 두면 한 달 쉬었다 온 사람의 곡선이
 * 오른쪽 끝에 뭉치고, 여기서 묻는 것은 "언제 했나"가 아니라 "늘고 있나"다.
 *
 * 기록 탭과 코스 화면이 같은 그림을 쓴다. 크기만 다르다 — 같은 값을 두 곳에서
 * 다르게 그리면 둘 중 하나는 거짓말이 된다.
 */
export function Sparkline({
  times,
  className,
}: {
  /** 오래된 판부터. 두 점 이상이어야 선이 된다. */
  times: number[];
  className?: string;
}) {
  const W = 96;
  const H = 32;
  /*
   * 양옆을 조금 비운다. 끝 점이 viewBox 경계에 걸리면 동그라미가 반만 그려진다 —
   * 하필 그게 마지막 판이라 제일 보여야 할 점이다.
   */
  const PAD = 4;

  const max = Math.max(...times);
  const min = Math.min(...times);
  const span = max - min || 1;

  const points = times.map((t, i) => {
    const x = PAD + (i / Math.max(1, times.length - 1)) * (W - PAD * 2);
    const y = ((t - min) / span) * (H - 6) + 3;
    return [x, H - y] as const;
  });

  const last = points.at(-1)!;
  const lastIsBest = times.at(-1) === min;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label={`최근 ${times.length}판의 기록 흐름`}
    >
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--color-sign)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        /*
         * 폭을 늘려 그려도 선 굵기는 그대로여야 한다. `preserveAspectRatio`를
         * 끄면 좌표가 늘어나면서 선까지 굵어진다.
         */
        vectorEffect="non-scaling-stroke"
      />
      {/*
        마지막 판. 최고 기록이면 노랑 — 그 판이 무엇이었는지가 곧 다음 판의 이유다.

        동그라미가 아니라 **세로 눈금**이다. 폭을 늘려 그리려고 종횡비를 풀어
        두었는데(`preserveAspectRatio="none"`), 그러면 원도 같이 늘어나 타원이
        된다. 세로선은 늘어나도 세로선이고, 굵기는 `non-scaling-stroke`가 지킨다.
      */}
      <line
        x1={last[0]}
        y1={last[1] - 5}
        x2={last[0]}
        y2={last[1] + 5}
        stroke={lastIsBest ? "var(--color-centerline)" : "var(--color-sign)"}
        strokeWidth={4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

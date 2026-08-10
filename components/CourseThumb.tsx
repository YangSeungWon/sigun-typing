import thumbs from "@/data/geo/thumbs.json";

interface CourseThumbProps {
  courseId: string;
  className?: string;
}

/**
 * 코스 실루엣.
 *
 * 코스는 "31개 시군"이 아니라 "북서 연천에서 남동 안성까지, 인접한 시군을
 * 따라 한 바퀴"다. 그 말이 글로만 있고 화면에는 없었다. 실루엣과 시작·끝
 * 점을 같이 두면 고르기 전에 어떤 여정인지 눈으로 읽힌다.
 *
 * 원본 경계 대신 빌드 때 만든 실루엣을 쓴다(`npm run build:thumbs`).
 * 코스 하나가 40~76KB인데 목록에 열일곱 개를 실을 수는 없다.
 */
export function CourseThumb({ courseId, className }: CourseThumbProps) {
  const thumb = (thumbs as Record<string, { d: string; from: number[]; to: number[] }>)[
    courseId
  ];
  if (!thumb) return null;

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/*
        카드 바탕이 거의 흰색이라 옅은 회색으로 칠하면 형태가 안 읽힌다.
        지도라는 느낌은 유지하되 실루엣은 또렷해야 한다.
      */}
      <path d={thumb.d} fill="var(--color-dim)" opacity={0.5} />
      {/* 시작과 끝. 코스가 경로라는 사실이 여기서 드러난다. */}
      <circle cx={thumb.from[0]} cy={thumb.from[1]} r={5} fill="var(--color-sign)" />
      <circle
        cx={thumb.to[0]}
        cy={thumb.to[1]}
        r={5}
        fill="var(--color-paint)"
        stroke="var(--color-sign)"
        strokeWidth={2.5}
      />
    </svg>
  );
}

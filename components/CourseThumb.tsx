import thumbs from "@/data/thumbs.json";

interface CourseThumbProps {
  courseId: string;
  className?: string;
}

type Thumb = { d: string; from: number[]; to: number[] };

/**
 * 코스 실루엣.
 *
 * 코스는 "31개 시군"이 아니라 "북서 연천에서 남동 안성까지, 인접한 시군을
 * 따라 한 바퀴"다. 실루엣과 시작·끝 점을 같이 두면 고르기 전에 어떤 여정인지
 * 눈으로 읽힌다.
 *
 * 여기서 주인공은 지형이지 마커가 아니다. 점이 실루엣보다 강하면 지도가
 * 아이콘처럼 보인다 — 그래서 점은 작게, 지형은 크게 잡는다.
 *
 * 원본 경계 대신 빌드 때 만든 실루엣을 쓴다(`npm run build:thumbs`).
 * 코스 하나가 40~76KB인데 목록에 열일곱 개를 실을 수는 없다.
 */
export function CourseThumb({ courseId, className }: CourseThumbProps) {
  const thumb = (thumbs as Record<string, Thumb>)[courseId];
  if (!thumb) return null;

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/*
        카드 바탕이 거의 흰색이라 옅은 회색으로 칠하면 형태가 안 읽힌다.
        마우스를 올리면 한 단계 진해진다 — 그림자를 띄우는 것보다 이쪽이
        이 화면의 언어에 맞는다.
      */}
      <path
        d={thumb.d}
        fill="var(--color-dim)"
        className="opacity-50 transition-opacity group-hover:opacity-70"
      />

      {/*
        시작에서 끝으로 선이 그어진다.
        마우스를 올리면 시작점에서 출발해 끝점까지 그어지고, 잠깐 쉬었다가
        다시 그어진다. 범례로 "● 시작 ○ 끝"이라고 적어 두는 것보다 이쪽이
        빠르다 — 움직임 자체가 "여기서 저기까지 가는 코스"라고 말한다.
      */}
      <line
        x1={thumb.from[0]}
        y1={thumb.from[1]}
        x2={thumb.to[0]}
        y2={thumb.to[1]}
        stroke="var(--color-sign)"
        strokeWidth={2}
        strokeLinecap="round"
        pathLength={1}
        className="course-line opacity-0 group-hover:opacity-80"
      />

      <circle cx={thumb.from[0]} cy={thumb.from[1]} r={3.5} fill="var(--color-sign)" />
      <circle
        cx={thumb.to[0]}
        cy={thumb.to[1]}
        r={3.5}
        fill="var(--color-paint)"
        stroke="var(--color-sign)"
        strokeWidth={2}
      />
    </svg>
  );
}

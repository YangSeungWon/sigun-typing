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
        여정은 손이 닿을 때만 보인다.
        점 두 개를 늘 띄워 두었더니 목록에서 실루엣보다 점이 먼저 읽혔고,
        인천처럼 작은 썸네일에서는 지도가 점 두 개짜리 아이콘이 되었다.
        기본 상태의 카드에 필요한 것은 지역명·실루엣·한 줄 설명뿐이다.

        순서가 있다 — 시작점이 먼저 서고, 선이 그어지고, 끝점이 나중에 온다.
        범례로 "● 시작 ○ 끝"이라고 적어 두는 것보다 이쪽이 빠르다.
        이 선은 문제 순서가 아니라 코스가 어디서 어디로 가는지를 말한다.
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
        className="course-line opacity-0 group-hover:opacity-80 group-focus-visible:opacity-80"
      />

      <circle
        cx={thumb.from[0]}
        cy={thumb.from[1]}
        r={3.5}
        fill="var(--color-sign)"
        className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <circle
        cx={thumb.to[0]}
        cy={thumb.to[1]}
        r={3.5}
        fill="var(--color-paint)"
        stroke="var(--color-sign)"
        strokeWidth={2}
        // 선이 도착한 뒤에 선다. 먼저 떠 있으면 그어질 곳이 이미 정해져 보인다.
        className="opacity-0 transition-opacity delay-500 duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </svg>
  );
}

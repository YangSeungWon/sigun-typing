import thumbs from "@/data/thumbs.json";

interface CourseThumbProps {
  courseId: string;
  className?: string;
}

type Thumb = { d: string; borders: string; route: number[][] };

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
  if (!thumb || thumb.route.length < 2) return null;
  const start = thumb.route[0];
  const end = thumb.route[thumb.route.length - 1];

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
        지역 경계.
        실루엣을 하나로 합치면서 "여러 곳으로 나뉜다"는 감각을 잃었다. 그건
        지도가 글자보다 빠르게 할 수 있는 말이라 되찾아 둔다.

        기본 상태에도 남긴다. 얼기설기해 보이던 예전과는 다른 것이다 — 그때는
        서로 다른 면을 겹쳐 칠해 흰 틈이 벌어진 것이었고, 이건 실루엣 안에
        새겨진 선이다. 대신 아주 옅게 둬서 멀리서는 결처럼만 읽히고,
        손이 닿으면 한 단계 또렷해진다.

        채우지 않고 선으로만 긋는다. 면을 겹쳐 칠할 때 생기던 실틈이 여기서는
        생길 수 없다.
      */}
      <defs>
        {/*
          경계선을 실루엣 안쪽으로 잘라낸다. 경계는 실루엣보다 거칠게
          줄여 놓았으므로, 자르지 않으면 바깥으로 삐져나가 가장자리에
          후광처럼 남는다.
        */}
        <clipPath id={`thumb-${courseId}`}>
          <path d={thumb.d} />
        </clipPath>
      </defs>
      <path
        d={thumb.borders}
        clipPath={`url(#thumb-${courseId})`}
        fill="none"
        // 밝은 선은 면이 갈라진 것처럼 보인다. 지도책의 경계는 새겨진 선이다.
        stroke="var(--color-ink)"
        strokeWidth={0.5}
        strokeLinejoin="round"
        className="opacity-[0.14] transition-opacity duration-300 group-hover:opacity-30 group-focus-visible:opacity-30"
      />

      {/*
        여정은 손이 닿을 때만 보인다.
        점 두 개를 늘 띄워 두었더니 목록에서 실루엣보다 점이 먼저 읽혔고,
        인천처럼 작은 썸네일에서는 지도가 점 두 개짜리 아이콘이 되었다.
        기본 상태의 카드에 필요한 것은 지역명·실루엣·한 줄 설명뿐이다.

        **직선이 아니라 지나는 길이다.** 시작과 끝만 이으면 "어디서 어디까지"
        밖에 말하지 못하는데, 코스의 값어치는 그 사이를 어떻게 도는가에 있다.
        선이 지역들을 차례로 훑고 지나가면 `은평에서 강북을 돌아 한강을 건너,
        강동에서 강서까지`라는 한 줄이 눈으로 한 번 더 읽힌다.

        문제 순서가 아니라 코스의 지리적 흐름이다 — 실제 플레이에서는 순서가
        섞인다. 그래서 번호를 붙이거나 한 곳씩 점멸시키지 않는다.
      */}
      <path
        d={`M${thumb.route.map(([x, y]) => `${x},${y}`).join("L")}`}
        fill="none"
        stroke="var(--color-sign)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="course-line opacity-0 group-hover:opacity-80 group-focus-visible:opacity-80"
      />

      <circle
        cx={start[0]}
        cy={start[1]}
        r={3.5}
        fill="var(--color-sign)"
        className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <circle
        cx={end[0]}
        cy={end[1]}
        r={3.5}
        fill="var(--color-paint)"
        stroke="var(--color-sign)"
        strokeWidth={2}
        // 선이 도착한 뒤에 선다. 먼저 떠 있으면 갈 곳이 이미 정해져 보인다.
        className="opacity-0 transition-opacity delay-700 duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </svg>
  );
}

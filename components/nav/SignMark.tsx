/**
 * 표지판 마크.
 *
 * `app/icon.svg`와 같은 형태다 — 판면, 내곽선, 가운데 화살표. 파비콘이 브라우저
 * 탭에서 하는 일을 헤더에서 한다. 마크는 여태 탭과 홈 화면 아이콘에만 살아
 * 있었고, 정작 사이트 안에서는 한 번도 보이지 않았다.
 *
 * 파일을 `<img>`로 부르지 않고 다시 그린 이유는 색이다. 파일 안의 값은 굳어
 * 있어서 어두운 판에서 초록이 이끼색으로 가라앉는다. 인라인이면 토큰을 쓸 수
 * 있다(칠하는 규칙은 globals.css의 `.sign-mark-*`).
 *
 * 글자는 넣지 않는다. 옆에 이름이 이미 적혀 있고, 20px에서 읽히는 글자는 없다.
 */
export function SignMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect className="sign-mark-plate" width="64" height="64" rx="12" />
      <rect
        className="sign-mark-edge"
        x="7"
        y="7"
        width="50"
        height="50"
        rx="7"
        fill="none"
        strokeWidth="3"
      />
      <path
        className="sign-mark-arrow"
        d="M22 40 L32 20 L42 40"
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

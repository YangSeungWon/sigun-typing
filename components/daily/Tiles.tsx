import { MAX_TRIES, type Closeness } from "@/lib/daily/quiz";

/**
 * 낸 답 여섯 칸.
 *
 * **숫자를 안 쓴다.** `1 / 6`도 `1번 만에 정답`도 이 줄이 이미 하는 말이다 —
 * 채워진 칸과 빈 칸을 보면 몇 번에 끝냈는지가 세지 않아도 읽힌다.
 *
 * 화면에서는 이모지를 안 쓴다. 🟩은 운영체제마다 다르게 그려져서 어떤 기기에서는
 * 모서리가 둥근 사탕이 되고 어떤 기기에서는 각진 블록이 된다. 그림이 화면의
 * 다른 것과 따로 노는 것도 문제지만, 크기와 색을 이쪽에서 못 정하는 것이 더
 * 문제다. 공유 문구는 글자밖에 실을 수 없으니 거기서만 이모지를 쓴다.
 *
 * 색은 셋을 그대로 둔다. 명세는 `성공 초록 / 실패 회색`으로 줄이자고 했는데,
 * 이 사이트에서 노랑은 이미 `가까움`이라는 뜻을 지고 있고(지도·결과 카드·공유
 * 격자가 전부 그 셋을 쓴다) 그게 이 게임의 유일한 단서다. 여기서만 둘로 줄이면
 * 같은 판이 화면마다 다른 말을 하게 된다.
 */
export function Tiles({
  marks,
  className,
}: {
  marks: readonly Closeness[];
  className?: string;
}) {
  return (
    <span className={`flex gap-1.5 ${className ?? ""}`}>
      {Array.from({ length: MAX_TRIES }, (_, i) => {
        const m = marks[i];
        return (
          <span
            key={i}
            aria-hidden
            className={`size-[18px] rounded-xs ${
              m === "hit"
                ? "bg-sign"
                : m === "near"
                  ? "bg-centerline"
                  : m === "far"
                    ? "bg-alert"
                    : "border border-edge"
            }`}
          />
        );
      })}
    </span>
  );
}

import { decompose } from "./jamo";

/**
 * 두 낱말이 자모 몇 개 차이인가.
 *
 * 오답을 **오타와 착각으로 가르는** 데 쓴다. `안양`을 치려다 `안양시`가 아니라
 * `안얌`이 나온 것은 손이 미끄러진 것이고, `연천`이 나온 것은 다른 곳을 떠올린
 * 것이다. 글자 단위로 세면 이 둘이 구별되지 않는다 — `안얌`과 `연천`은 똑같이
 * 한 글자 차이다. 자모로 펴야 1과 4로 갈린다.
 *
 * 두벌식 타건 순서로 편다(`decompose`). 자판에서 실제로 몇 번 잘못 눌렀는지가
 * 여기서 재려는 값이므로, 겹받침과 복합모음도 눌린 횟수대로 세는 그 분해가 맞다.
 *
 * 삽입·삭제·치환을 모두 1로 보는 평범한 레벤슈타인이다. 자판 거리로 가중치를
 * 주는 방법도 있지만, 이 값은 "1 이하인가"만 묻는 데 쓰이므로 정교해져 봐야
 * 답이 달라지지 않는다.
 */
export function jamoDistance(a: string, b: string): number {
  const x = decompose(a);
  const y = decompose(b);

  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;

  // 앞 줄 하나만 들고 간다. 거리 값만 필요하고 경로는 필요 없다.
  let previous = Array.from({ length: y.length + 1 }, (_, j) => j);

  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[y.length];
}

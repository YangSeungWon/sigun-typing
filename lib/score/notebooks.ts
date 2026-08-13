import type { ItemResult } from "../game/types";
import type { PeerName } from "./confusion";

/**
 * 한 판의 결과를 **어느 오답노트에 넣을 것인가.**
 *
 * 여태 답이 하나였다 — 방금 한 코스. 코스들이 서로 겹치지 않았으므로 그걸로
 * 충분했다.
 *
 * 전국 시군구 코스가 그 전제를 깬다. 거기서 도봉구를 틀리면 `nationwide`
 * 노트에 쌓이는데, 서울 코스에서 틀린 도봉구는 `seoul` 노트에 있다. 같은 곳이
 * 두 군데에 쌓이면 헷갈리는 곳 카드에 같은 짝이 두 번 뜨고, 정복도는 두 번
 * 세며, 오답 연습은 반쪽만 데려간다.
 *
 * 그래서 겹치는 코스의 결과는 지역이 **원래 속한 코스**로 나눠 담는다. 전국을
 * 한 바퀴 돈 사람의 부산 오답은 부산 노트에 들어간다 — 어느 코스로 만났든
 * 도봉구를 헷갈린다는 사실은 하나다.
 *
 * 완주 기록(개인 최고)은 나누지 않는다. 228곳을 한 번에 도는 것은 열여섯 판으로
 * 나눠 도는 것과 다른 일이고, 그건 이 함수가 아니라 부르는 쪽이 정한다.
 */
export interface Notebook {
  courseId: string;
  results: ItemResult[];
  /** 이 코스의 지역 이름들. 오답이 오타인지 착각인지 가리는 데 쓴다. */
  peers: PeerName[];
}

export interface CourseLike {
  id: string;
  regions: { code: string; name: string; aliases?: string[] }[];
}

export function splitNotebooks(
  results: ItemResult[],
  course: CourseLike & { overlapping?: boolean },
  all: CourseLike[],
): Notebook[] {
  if (!course.overlapping) {
    return [{ courseId: course.id, results, peers: course.regions }];
  }

  /*
   * 지역 코드 → 그 지역을 원래 담고 있는 코스.
   *
   * 겹치는 코스끼리 또 겹치는 일은 없으므로(전국 시군구 하나뿐이다) 먼저
   * 찾은 것을 쓴다. 자기 자신은 당연히 뺀다.
   */
  const owner = new Map<string, CourseLike>();
  for (const c of all) {
    if (c.id === course.id) continue;
    for (const r of c.regions) if (!owner.has(r.code)) owner.set(r.code, c);
  }

  const grouped = new Map<string, ItemResult[]>();
  for (const result of results) {
    const home = owner.get(result.id);
    // 주인을 못 찾은 결과는 버리지 않고 원래 코스에 남긴다.
    const key = home?.id ?? course.id;
    grouped.set(key, [...(grouped.get(key) ?? []), result]);
  }

  const byId = new Map(all.map((c) => [c.id, c]));
  return [...grouped].map(([courseId, group]) => ({
    courseId,
    results: group,
    peers: byId.get(courseId)?.regions ?? course.regions,
  }));
}

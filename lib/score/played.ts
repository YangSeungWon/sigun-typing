import { readJson, writeJson } from "../storage";

/**
 * 한 번이라도 끝까지 가 본 코스들.
 *
 * "이 코스를 해 봤는가"는 여태 **추론**이었다 — 오답이 남아 있거나 개인 기록이
 * 있으면 해 본 것으로 봤다(`lib/score/mastery.ts`). 코스 하나를 통째로 도는
 * 방법이 그 코스로 들어가는 것뿐일 때는 맞는 추론이었다.
 *
 * 전국 시군구 코스가 그 추론을 깬다. 거기서 부산 구간을 한 번도 안 틀리고
 * 지나가면 부산 노트에 남는 것이 없고, 개인 기록은 전국 코스 이름으로 저장된다.
 * 그러면 부산 열여섯 곳을 방금 다 맞혔는데도 정복도에는 0으로 남는다.
 *
 * 그래서 추론하지 말고 그냥 적어 둔다. 추론을 없애지는 않았다 — 이 목록이
 * 생기기 전에 놀던 사람들의 기록이 그대로 살아 있어야 하기 때문이다.
 */
const KEY = "sigun:played:v1";

export function loadPlayed(): Set<string> {
  const list = readJson(KEY, (raw) => {
    if (!Array.isArray(raw)) return null;
    return raw.filter((v): v is string => typeof v === "string");
  });
  return new Set(list ?? []);
}

/** 이미 있는 것에 더한다. 지우는 길은 두지 않는다 — 해 본 적 없는 일이 되지는 않는다. */
export function markPlayed(courseIds: string[]): boolean {
  const next = loadPlayed();
  const before = next.size;
  for (const id of courseIds) next.add(id);
  if (next.size === before) return true;
  return writeJson(KEY, [...next]);
}

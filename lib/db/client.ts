import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  MemoryScoreRepository,
  PostgresScoreRepository,
  type ScoreRepository,
} from "./repo";

/**
 * DATABASE_URL이 있으면 Postgres, 없으면 메모리 저장소를 쓴다.
 * 개발자가 DB 없이도 게임 전체를 돌려볼 수 있어야 하기 때문이다.
 */
let cached: ScoreRepository | null = null;

export const MISSING_DATABASE_URL = "DATABASE_URL이 설정되지 않았습니다";

/**
 * 운영인데 DB 주소가 없을 때 돌려주는 저장소. 무엇을 물어도 거절한다.
 *
 * 예전에는 `getScoreRepository()`가 그 자리에서 예외를 던졌다. 뜻은 맞았지만
 * **채널이 틀렸다.** 이 저장소를 쓰는 코드는 전부 비동기라 안전망도 전부
 * 비동기인데(`.catch`, `try/await`), 동기 예외는 그 그물을 그냥 통과한다.
 *
 * 그래서 "DB가 흔들려도 목록은 그려야 한다"며 `.catch`를 두른 코스 목록이
 * 정작 주소가 없을 때는 통째로 죽었고, 도커 이미지 빌드가 그것 때문에
 * 실패했다 — 빌드 시점에 DB가 없는 것은 고장이 아니라 정상인데도.
 *
 * 실패를 없앤 것이 아니라 **같은 실패를 프로미스 거절로 옮겼다.** 곁들이는
 * 값이라 없어도 되는 곳(1위)은 자기가 두른 그물로 받아 넘기고, 없으면 안
 * 되는 곳(순위표·점수 제출)은 아무도 받지 않으므로 그대로 500으로 터진다.
 * 조용히 메모리 저장소로 뜨는 일은 여전히 일어나지 않는다.
 */
class MisconfiguredScoreRepository implements ScoreRepository {
  private fail<T>(): Promise<T> {
    return Promise.reject(new Error(MISSING_DATABASE_URL));
  }

  insert() { return this.fail<boolean>(); }
  leaderboard() { return this.fail<never[]>(); }
  standing() { return this.fail<{ better: number; total: number }>(); }
  bests() { return this.fail<Map<string, never>>(); }
  recentCount() { return this.fail<number>(); }
  recordEvents() { return this.fail<void>(); }
  neighbors() { return this.fail<{ above: never[]; below: never[] }>(); }
  recordError() { return this.fail<void>(); }
}

export function getScoreRepository(): ScoreRepository {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      // 운영에서 메모리 저장소로 뜨면 기록이 재배포마다 사라진다. 조용히 넘기지 않는다.
      // 캐시에 넣지 않는다 — 설정이 잘못된 상태를 굳혀 둘 이유가 없다.
      return new MisconfiguredScoreRepository();
    }
    console.warn("[ranking] DATABASE_URL이 없어 메모리 저장소를 씁니다 — 기록은 유지되지 않습니다");
    cached = new MemoryScoreRepository();
    return cached;
  }

  // 서버리스에서는 커넥션을 아껴야 한다.
  const sql = postgres(url, { max: 1, prepare: false });
  cached = new PostgresScoreRepository(drizzle(sql));
  return cached;
}

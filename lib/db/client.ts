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

export function getScoreRepository(): ScoreRepository {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      // 운영에서 메모리 저장소로 뜨면 기록이 재배포마다 사라진다. 조용히 넘기지 않는다.
      throw new Error("DATABASE_URL이 설정되지 않았습니다");
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

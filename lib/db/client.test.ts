import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 설정이 잘못됐을 때 어떻게 실패하는가.
 *
 * 실패하느냐가 아니라 **어느 채널로** 실패하느냐가 요점이다. 이 저장소를 쓰는
 * 코드는 전부 비동기라 안전망도 전부 비동기인데, 동기로 던지면 그 그물을 그냥
 * 통과해 버린다. 그래서 "DB가 흔들려도 목록은 그려야 한다"고 `.catch`를 두른
 * 화면이 정작 주소가 없을 때 통째로 죽었다.
 */

/*
 * client.ts는 저장소를 모듈 변수에 캐시하고 process.env를 읽는다.
 * 판마다 새로 읽게 하려면 모듈 자체를 다시 불러야 한다.
 */
async function freshClient() {
  vi.resetModules();
  return import("./client");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("운영인데 DATABASE_URL이 없을 때", () => {
  it("저장소를 받는 것 자체는 실패하지 않는다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const { getScoreRepository } = await freshClient();

    // 여기서 던지면 호출부의 .catch가 손쓸 방법이 없다.
    expect(() => getScoreRepository()).not.toThrow();
  });

  it("무엇을 물어도 거절한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const { getScoreRepository, MISSING_DATABASE_URL } = await freshClient();
    const repo = getScoreRepository();

    await expect(repo.bests([], "map", 1)).rejects.toThrow(MISSING_DATABASE_URL);
    await expect(repo.leaderboard("seoul", "map", 10, 1, 1)).rejects.toThrow(
      MISSING_DATABASE_URL,
    );
    await expect(repo.recordEvents("d", [])).rejects.toThrow(MISSING_DATABASE_URL);
  });

  it("곁들이는 값을 읽는 쪽은 자기 그물로 받아 넘긴다", async () => {
    // 코스 목록이 하는 것과 같은 모양. 1위 때문에 화면이 죽으면 안 된다.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const { getScoreRepository } = await freshClient();

    const bests = await getScoreRepository()
      .bests([], "map", 1)
      .catch(() => new Map());

    expect(bests.size).toBe(0);
  });

  it("메모리 저장소로 조용히 뜨지 않는다", async () => {
    /*
     * 이게 원래 예외를 두었던 이유다. 메모리 저장소로 뜨면 기록이 재배포마다
     * 사라지는데 아무도 모른다. 거절로 옮겼어도 그 성질은 유지되어야 한다.
     */
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const { getScoreRepository } = await freshClient();

    await expect(getScoreRepository().insert({} as never)).rejects.toThrow();
  });

  it("잘못된 설정을 캐시에 굳혀 두지 않는다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const { getScoreRepository } = await freshClient();

    const broken = getScoreRepository();
    vi.stubEnv("DATABASE_URL", "postgres://u:p@127.0.0.1:5432/x");

    // 캐시에 굳었다면 주소가 생긴 뒤에도 같은 것이 돌아온다.
    expect(getScoreRepository()).not.toBe(broken);
  });
});

describe("개발 중 DATABASE_URL이 없을 때", () => {
  it("메모리 저장소로 뜬다 — DB 없이도 게임 전체를 돌려볼 수 있어야 한다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getScoreRepository } = await freshClient();

    await expect(getScoreRepository().bests([], "map", 1)).resolves.toBeInstanceOf(Map);
  });

  it("조용히 넘어가지는 않는다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getScoreRepository } = await freshClient();

    getScoreRepository();
    expect(warn).toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { EVENT_NAMES, sanitizeEvent } from "./events";

/**
 * 계측 데이터는 한 번 잘못 쌓이면 되돌릴 수 없다. 실험 기간이 끝난 뒤에
 * "이 값이 왜 다 0이지"를 알아차려도 그 기간은 이미 버린 것이다.
 */
describe("이벤트 정제", () => {
  it("판 기준 경과 시간을 살려 둔다", () => {
    // created_at은 3초마다 묶어 보내느라 뭉개진다. 시간은 이 값으로만 잰다.
    expect(sanitizeEvent({ name: "first_correct", atMs: 4_200 })?.atMs).toBe(4_200);
  });

  it("음수 시간은 버린다", () => {
    // 기기 시계가 뒤로 갔을 때 나온다. 그대로 두면 평균이 오염된다.
    expect(sanitizeEvent({ name: "first_correct", atMs: -1 })?.atMs).toBeUndefined();
  });

  it("힌트 해결 시간을 받는다", () => {
    const e = sanitizeEvent({
      name: "hint_resolved",
      elapsedMs: 1_800,
      progress: 3,
      total: 17,
    });
    expect(e).toMatchObject({ name: "hint_resolved", elapsedMs: 1_800, progress: 3 });
  });

  it("이벤트 식별자를 살려 둔다", () => {
    // 서버가 중복을 걸러내는 유일한 근거다.
    const id = "6f1e5b3a-0000-4000-8000-000000000000";
    expect(sanitizeEvent({ name: "game_quit", id })?.id).toBe(id);
  });

  it("모르는 이름은 통째로 버린다", () => {
    expect(sanitizeEvent({ name: "keystroke", atMs: 1 })).toBeNull();
  });

  it("네 지표를 계산할 이름이 모두 있다", () => {
    // 홈→시작→첫 정답→완주, 그리고 힌트 두 종류.
    for (const name of [
      "home_view",
      "game_start",
      "first_correct",
      "game_finish",
      "hint_used",
      "hint_resolved",
    ]) {
      expect(EVENT_NAMES).toContain(name);
    }
  });
});

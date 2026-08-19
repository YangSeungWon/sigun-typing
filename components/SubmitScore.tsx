"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, ModeId, Score } from "@/lib/game/types";
import { getSavedNickname, saveNickname, submitScore } from "@/lib/score/client";

interface SubmitScoreProps {
  token: string | null;
  courseId: string;
  mode: ModeId;
  seed: number;
  state: GameState;
  score: Score;
}

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; rank: number | null }
  | { kind: "failed"; error: string };

/** 결과 화면에서 기록을 랭킹에 올린다. */
export function SubmitScore({
  token,
  courseId,
  mode,
  seed,
  state,
  score,
}: SubmitScoreProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * 저장해 둔 이름을 ref 콜백에서 직접 넣는다. 입력을 상태로 들고 있으면
   * 서버 렌더 결과("")와 클라이언트 값이 달라 하이드레이션이 어긋난다.
   */
  const attach = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (!el) return;
    if (!el.value) el.value = getSavedNickname();
    // 열자마자 칠 수 있어야 한다. 열어 놓고 또 눌러야 하면 한 걸음 더다.
    el.focus();
  }, []);

  if (!token) {
    return (
      <p className="font-mono text-sm text-dim">
        기록을 남길 수 없는 상태로 시작해 이번 판은 랭킹에 오르지 않습니다
      </p>
    );
  }

  /*
   * 한 곳도 못 맞힌 판은 올리지 않는다. 모르겠다고 전부 넘겨도 판은 끝나므로,
   * 그대로 두면 0타/분 기록이 순위표 바닥에 쌓인다. 개인 기록도 같은 이유로
   * 완주 0을 저장하지 않는다.
   */
  if (score.completed === 0) {
    return (
      <p className="font-mono text-sm text-dim">
        한 곳도 맞히지 못한 판은 랭킹에 올리지 않습니다
      </p>
    );
  }

  if (status.kind === "done") {
    return (
      <p className="font-mono text-sm text-ink" role="status">
        {status.rank
          ? `랭킹 ${status.rank}위로 올랐습니다`
          : "기록을 올렸습니다"}
      </p>
    );
  }

  const send = async () => {
    const name = (inputRef.current?.value ?? "").trim();
    if (!name) {
      setStatus({ kind: "failed", error: "이름을 입력하세요" });
      return;
    }
    setStatus({ kind: "sending" });
    saveNickname(name);
    const outcome = await submitScore({
      token,
      courseId,
      mode,
      seed,
      nickname: name,
      state,
      score,
    });
    setStatus(
      outcome.ok
        ? { kind: "done", rank: outcome.rank ?? null }
        : { kind: "failed", error: outcome.error ?? "제출에 실패했습니다" },
    );
  };

  /*
   * 이름 칸을 처음부터 펼쳐 두지 않는다.
   *
   * 결과를 보고 있는데 화면 끝에 입력 양식이 하나 붙어 있으면, 게임이
   * 끝난 자리에 갑자기 서류가 나온 것처럼 읽힌다. 등록할 사람만 열면 되고,
   * 열기 전에는 "여기가 몇 등짜리 기록인가" 한 줄만 있으면 된다 — 그게
   * 등록할 이유이기도 하다.
   */
  /*
   * 접힌 상태는 **한 줄**이다.
   *
   * 여태 순위 안내가 문장으로 한 줄, 버튼이 또 한 줄이라 결과 화면에서 두 칸을
   * 먹었다. `이 코스 1등 자리가 비어 있습니다`가 `한 번 더`·`다른 코스` 같은
   * 동작 버튼들 사이에서 혼자 말을 걸어 흐름이 끊겼다.
   *
   * `랭킹`이라는 이름과 상태와 단추를 한 줄에 세운다. `지금 등록하면`은 뺐다 —
   * 바로 옆에 `등록`이 있으니 문맥이 이미 그 말이다.
   */
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-lg border border-concrete-deep px-4 py-2.5">
        <span className="font-mono text-sm text-dim">랭킹</span>
        {/*
          가운데는 서버 응답을 기다렸다 채운다. 자리는 처음부터 잡아 둔다 —
          조건부로 넣으면 응답이 늦을 때 줄이 생기면서 아래가 통째로 밀린다.
        */}
        <Standing courseId={courseId} mode={mode} cpm={score.cpm} />
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-concrete-deep px-4 py-1.5 font-medium whitespace-nowrap text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            등록
          </button>
        )}
      </div>

      {/*
        이름 칸은 누른 뒤에만 나온다. 결과를 보고 있는데 화면 끝에 입력 양식이
        붙어 있으면, 게임이 끝난 자리에 갑자기 서류가 나온 것처럼 읽힌다.
        펼치면 줄의 `등록`은 사라진다 — 같은 이름의 단추가 둘이면 어느 쪽이
        진짜인지 매번 고민하게 된다.
      */}
      {open && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="nickname">
              랭킹에 표시할 이름
            </label>
            <input
              id="nickname"
              ref={attach}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={12}
              placeholder="이름"
              className="flex-1 rounded-lg border border-concrete-deep bg-paint px-4 py-3 text-ink placeholder:text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <button
              type="button"
              onClick={send}
              disabled={status.kind === "sending"}
              // 줄바꿈을 막는다. 좁은 칸에서 "랭킹 등 록"으로 접혔다.
              className="rounded-lg border border-concrete-deep bg-paint px-5 py-3 font-medium whitespace-nowrap text-ink transition-colors hover:bg-concrete-deep disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {status.kind === "sending" ? "올리는 중" : "랭킹 등록"}
            </button>
          </div>
          {status.kind === "failed" && (
            <p className="font-mono text-sm text-alert" role="alert">
              {status.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 등록하면 어디쯤 앉는지.
 *
 * 등록 버튼만 있으면 그건 양식이지 동기가 아니다. "왜 등록해야 하는데?"에
 * 대한 답이 여기 있다.
 *
 * 기록 수에 따라 말을 바꾼다. 표본이 몇 개일 때 "상위 8%"는 숫자를 지어내는
 * 것에 가깝다 — 열두 명 중 하나면 그냥 몇 위인지 말하는 편이 정확하고,
 * 그 편이 더 와닿기도 한다. 퍼센트는 모수가 쌓이면 저절로 나타난다.
 */
const PERCENTILE_MIN = 30;

function Standing({
  courseId,
  mode,
  cpm,
}: {
  courseId: string;
  mode: ModeId;
  cpm: number;
}) {
  const [standing, setStanding] = useState<{ rank: number; total: number } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({
      course: courseId,
      mode,
      cpm: String(Math.round(cpm)),
    });
    fetch(`/api/scores/standing?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data && typeof data.rank === "number") setStanding(data);
      })
      .catch(() => {
        // 순위를 못 읽어도 등록은 되어야 한다.
      });
    return () => {
      alive = false;
    };
  }, [courseId, mode, cpm]);

  /*
   * 자리는 늘 지킨다.
   *
   * 못 읽었을 때 `null`을 돌려주면 그 자리가 통째로 사라졌다 나타나면서
   * 아래 단추가 위아래로 움직인다. 서버 응답이 늦으면 결과 화면을 보는
   * 도중에 레이아웃이 튄다.
   */
  if (!standing) return <span className="flex-1" />;

  // 아직 아무 기록도 없다. "0명 중 1위"보다 비어 있는 자리로 말하는 게 낫다.
  if (standing.total === 0) {
    return (
      <span className="flex-1 font-mono text-sm text-sign">1위 비어 있음</span>
    );
  }

  if (standing.total < PERCENTILE_MIN) {
    return (
      <span className="flex-1 font-mono text-sm text-ink">
        <span className="font-semibold text-sign">{standing.rank}위</span>
        <span className="text-dim"> / {standing.total}개</span>
      </span>
    );
  }

  // 상위 몇 %. 1위를 "상위 0%"라고 쓰지 않도록 올림한다.
  const top = Math.max(1, Math.round((standing.rank / (standing.total + 1)) * 100));
  return (
    <span className="flex-1 font-mono text-sm text-ink">
      <span className="font-semibold text-sign">상위 {top}%</span>
      {/*
        같은 사실을 두 가지로 말한 것이라 좁은 화면에서는 하나만 남긴다.
        결과 화면에서는 절대 순위보다 상대 위치가 빨리 읽히므로 남는 쪽은 %다.
      */}
      <span className="hidden text-dim sm:inline">
        {" "}
        {standing.total}개 중 {standing.rank}위
      </span>
    </span>
  );
}

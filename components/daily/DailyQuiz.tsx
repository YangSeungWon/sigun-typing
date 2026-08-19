"use client";

import { useMemo, useState } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { RegionMap } from "@/components/RegionMap";
import {
  closeness,
  isOver,
  MAX_TRIES,
  QUIZ_EMOJI,
  sidoCleared,
  type QuizState,
} from "@/lib/daily/quiz";
import { quizShareText } from "@/lib/daily/quiz";
import { loadQuiz, saveQuiz } from "@/lib/daily/store";
import { ShareCard } from "@/components/share/ShareCard";

export interface QuizRegion {
  code: string;
  name: string;
  aliases?: string[];
  cx: number;
  cy: number;
}

interface DailyQuizProps {
  day: number;
  geo: CourseGeo;
  /** 전국 229곳. 답을 찾고 위치를 재는 데 쓴다. */
  regions: QuizRegion[];
  /** 시도 열일곱. 첫 계단의 선택지다. */
  sidos: { code: string; name: string }[];
  answerCode: string;
  /** 시도 이름. 공유 문구에 들어간다. */
  sidoName: string | null;
}

/**
 * 오늘의 퀴즈.
 *
 * 지도에 오늘의 한 곳이 켜져 있다. 어느 시도인지 짚고(횟수 안 셈), 그다음 이름을
 * 여섯 번 안에 맞힌다.
 *
 * **카메라를 당기지 않는다.** 전국이 다 보여야 틀린 답이 어디서 켜지는지 보이고,
 * 그게 이 판의 유일한 단서다. 당겨 두면 멀리 있는 오답이 화면 밖이라 아무것도
 * 안 보인다.
 */
export function DailyQuiz({
  day,
  geo,
  regions,
  sidos,
  answerCode,
  sidoName,
}: DailyQuizProps) {
  const answer = useMemo(
    () => regions.find((r) => r.code === answerCode)!,
    [regions, answerCode],
  );
  const answerSido = answerCode.slice(0, 2);

  /*
   * 저장된 판은 하이드레이션 뒤에 읽는다. 서버는 localStorage를 모르므로
   * 첫 렌더는 빈 판이어야 서버가 그린 것과 어긋나지 않는다.
   */
  const hydrated = useIsHydrated();
  const [state, setState] = useState<QuizState>(() => ({
    day,
    sidoPicks: [],
    guesses: [],
    solved: false,
  }));
  const [loaded, setLoaded] = useState(false);
  if (hydrated && !loaded) {
    setLoaded(true);
    setState(loadQuiz(day));
  }

  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const put = (next: QuizState) => {
    setState(next);
    saveQuiz(next);
  };

  const stage: "sido" | "region" | "done" = isOver(state)
    ? "done"
    : sidoCleared(state, answerSido)
      ? "region"
      : "sido";

  /** 틀리게 부른 곳들. 이름이 여럿에 걸리면 전부 켠다. */
  const namedCodes = useMemo(() => {
    const out: string[] = [];
    for (const g of state.guesses) {
      if (g.closeness === "hit") continue;
      for (const r of regions) {
        if (r.name === g.name && !out.includes(r.code)) out.push(r.code);
      }
    }
    return out;
  }, [state.guesses, regions]);

  const pickSido = (code: string) => {
    setNote(code === answerSido ? null : "거기가 아닙니다");
    put({ ...state, sidoPicks: [...state.sidoPicks, code] });
  };

  const submit = () => {
    const typed = input.trim();
    if (typed === "" || stage !== "region") return;

    const matches = regions.filter(
      (r) => r.name === typed || r.aliases?.includes(typed),
    );
    if (matches.length === 0) {
      setNote("그런 이름의 시군구가 없습니다");
      return;
    }

    const hit = matches.some((r) => r.code === answerCode);
    /*
     * 이름 하나가 여러 곳일 때는 **가장 가까운 곳**으로 잰다. 지도에는 전부
     * 켜지므로, 색이 말하는 것은 "네가 부른 이름 중 제일 가까운 것이 이만큼"이다.
     */
    const best = matches.reduce((a, b) =>
      Math.hypot(a.cx - answer.cx, a.cy - answer.cy) <=
      Math.hypot(b.cx - answer.cx, b.cy - answer.cy)
        ? a
        : b,
    );

    setInput("");
    setNote(null);
    put({
      ...state,
      solved: hit,
      guesses: [...state.guesses, { name: typed, closeness: closeness(best, answer, hit) }],
    });
  };

  const left = MAX_TRIES - state.guesses.length;
  const text = quizShareText(state, sidoName);

  return (
    <div className="flex w-full flex-col gap-5">
      <RegionMap
        geo={geo}
        variant="hint"
        currentCode={answerCode}
        namedCodes={namedCodes}
        /*
         * 판이 끝나면 이름을 짚어 볼 수 있게 연다. 그 전에는 안 된다 —
         * 짚는 순간 이름이 뜨고 그게 곧 답이다.
         */
        explore={stage === "done"}
        className="mx-auto h-[38vh] max-h-[26rem] w-auto"
      />

      {/* 낸 답들. 색이 곧 공유될 격자다. */}
      {state.guesses.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {state.guesses.map((g, i) => (
            <li
              key={`${g.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-concrete-deep px-4 py-2.5"
            >
              <span aria-hidden>{QUIZ_EMOJI[g.closeness]}</span>
              <span className="flex-1 font-medium">{g.name}</span>
              <span className="font-mono text-sm text-dim">
                {g.closeness === "hit" ? "정답" : g.closeness === "near" ? "가까움" : "멂"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {stage === "sido" && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-sm text-dim">어느 시도입니까</h2>
          <div className="flex flex-wrap gap-2">
            {sidos.map((s) => {
              const missed = state.sidoPicks.includes(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => pickSido(s.code)}
                  disabled={missed}
                  className="rounded-lg border border-concrete-deep px-4 py-2.5 font-medium transition-colors hover:bg-concrete-deep disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {stage === "region" && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-baseline justify-between gap-4 font-mono text-sm text-dim">
            <span>어느 시군구입니까</span>
            <span>{left}번 남음</span>
          </h2>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="guess">
              시군구 이름
            </label>
            <input
              id="guess"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
              placeholder="이름"
              className="flex-1 rounded-lg border border-concrete-deep bg-paint px-4 py-3 text-ink placeholder:text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <button
              type="button"
              onClick={submit}
              className="rounded-lg bg-sign px-5 py-3 font-medium whitespace-nowrap text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              제출
            </button>
          </div>
        </section>
      )}

      {note && (
        <p className="font-mono text-sm text-alert" role="status">
          {note}
        </p>
      )}

      {stage === "done" && (
        <section className="flex flex-col gap-4 rounded-xl border border-concrete-deep bg-paint/60 p-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-2xl font-bold">{answer.name}</p>
            <p className="font-mono text-sm text-dim">
              {state.solved
                ? `${state.guesses.length} / ${MAX_TRIES}`
                : `X / ${MAX_TRIES}`}
            </p>
          </div>

          {/*
            보내는 길은 결과 화면과 같은 것을 쓴다. 그림은 아직 없다 —
            도전장 카드는 기록을 실어 나르는 물건이라 오늘의 퀴즈용으로는
            따로 그려야 한다.
          */}
          <ShareCard
            text={text}
            path="/today"
            preview={
              <pre className="text-center text-lg leading-none whitespace-pre">
                {state.guesses.map((g) => QUIZ_EMOJI[g.closeness]).join("")}
              </pre>
            }
            tweet={text}
            kakao={{
              title: `오늘의 퀴즈 ${day + 1}일차`,
              description: `${sidoName ? `${sidoName} ` : ""}${
                state.solved ? `${state.guesses.length} / ${MAX_TRIES}` : `X / ${MAX_TRIES}`
              }, 같이 한 판?`,
            }}
          />

          {/*
            내일 다시 온다는 것을 알려 준다. 하루에 한 번인 게임에서 "끝"만
            적으면 오늘 여기서 관계가 끊긴다.
          */}
          <p className="font-mono text-sm text-dim">내일 새 문제가 나옵니다</p>
        </section>
      )}
    </div>
  );
}

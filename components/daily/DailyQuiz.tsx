"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { useIsHydrated } from "@/lib/useIsHydrated";
import { RegionMap } from "@/components/RegionMap";
import { MiniMap } from "@/components/MiniMap";
import {
  closeness,
  isOver,
  MAX_TRIES,
  QUIZ_EMOJI,
  sidoCleared,
  type QuizState,
} from "@/lib/daily/quiz";
import { cardCode, quizShareText } from "@/lib/daily/quiz";
import { quizDate } from "@/lib/daily/pick";
import { loadQuiz, saveQuiz } from "@/lib/daily/store";
import { ShareCard } from "@/components/share/ShareCard";
import { StreakBadge } from "./StreakBadge";
import { NextQuiz } from "./NextQuiz";
import { aliveOn, loadStreak, recordDay, type Streak } from "@/lib/daily/streak";

/** 시군구를 이루는 끝 글자 셋. 화면에 쓰는 `시군구`와 같은 차례로 둔다. */
const SUFFIXES = ["시", "군", "구"] as const;

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
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loaded, setLoaded] = useState(false);
  if (hydrated && !loaded) {
    setLoaded(true);
    const saved = loadQuiz(day);
    setState(saved);
    /*
     * 이미 끝난 판을 들고 왔으면 그날치는 벌써 세어져 있다. `recordDay`가 같은
     * 날을 두 번 안 세므로 그냥 부르면 되고, 그래야 새로고침해도 숫자가 남는다.
     */
    setStreak(isOver(saved) ? recordDay(day, saved.solved) : loadStreak());
  }

  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  /*
   * 없는 이름을 냈을 때 남은 횟수를 한 번 튀게 하는 표시.
   *
   * 값이 바뀔 때마다 React가 그 노드를 새로 만들도록 key로 쓴다 — 같은 클래스를
   * 다시 붙이는 것만으로는 CSS 애니메이션이 두 번째부터 안 돈다.
   */
  const [rejected, setRejected] = useState(0);

  const put = (next: QuizState) => {
    setState(next);
    saveQuiz(next);
    // 끝나는 순간 하루치를 센다. 같은 날 두 번 불러도 한 번만 세어진다.
    if (isOver(next)) setStreak(recordDay(next.day, next.solved));
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

  /*
   * 짚은 시도는 꺼진다. 그 이상 말하지 않는다.
   *
   * `거기가 아닙니다`를 띄우고 있었다. 단추가 이미 흐려지고 눌리지 않게 되는데
   * 그 옆에 문장을 하나 더 놓는 꼴이었고, 게다가 다음 시도를 짚는 동안에도
   * 그 자리에 그대로 남아 있었다 — 방금 일어난 일이 아니라 화면에 붙박인
   * 잔소리로 읽힌다.
   *
   * `거기`도 이 화면에서는 헷갈리는 말이다. 지도가 켜져 있는 판이라 지도 위
   * 어딘가를 가리키는 말로 먼저 읽힌다.
   */
  /**
   * 입력칸에 미리 앉혀 두는 이름.
   *
   * 이 게임의 정답은 지도에 적히는 정식 명칭이다 — `해운대구`, `이천시`,
   * `가평군`(data/courses/place.ts). 본편에서는 표지판이 이름이나 초성을
   * 보여 주므로 그 규칙이 눈에 보이는데, **이 화면에서만 안 보인다.** 지도가
   * 이름을 안 띄우는 것이 이 퀴즈의 전부이기 때문이다.
   *
   * 그래서 `해운대`를 아는 사람이 `해운대`를 치고 `없는 이름입니다`를 받았다.
   * 규칙을 문장으로 적는 대신 형식을 하나 앉혀 둔다 — 빈 칸에 놓인 이름은
   * 예시로 읽힌다.
   *
   * 정답의 시도 밖에서 고른다. 제주는 두 곳, 세종은 한 곳이라 같은 시도에서
   * 뽑으면 그날 답이 반쯤 드러난다. 접미사가 보이도록 세 글자 이상만 쓴다 —
   * `중구`로는 무엇을 붙이라는 것인지 알 수 없다.
   */
  const sample = useMemo(() => {
    const pool = regions.filter(
      (r) => !r.code.startsWith(answerSido) && [...r.name].length >= 3,
    );
    /*
     * 성큼성큼 건너뛴다. `day % pool.length`로 두면 첫 며칠의 예시가 목록
     * 앞쪽에 몰려 전부 인천 언저리가 된다 — 답일 수는 없지만 그 근처를
     * 가리키는 것처럼 읽힌다.
     */
    return pool.length > 0 ? pool[(day * 89) % pool.length].name : "이름";
  }, [regions, answerSido, day]);

  /**
   * 접미사 단추를 낼 자리인가.
   *
   * 접미사 **하나만** 붙이면 실재하는 이름이 될 때 낸다 — `해운대`를 아는
   * 사람이 `구`를 붙여야 하는 줄 몰랐던 것뿐인 자리다. 이미 온전한 이름이면
   * 안 낸다.
   *
   * 앞부분이기만 하면 내도록 두었더니 치는 도중에 계속 떴다. `해`에서 벌써
   * `해시`·`해군`·`해구`가 뜨는데, 그건 도와주는 것이 아니라 말이 안 되는
   * 것을 세 개 보여 주는 것이다.
   *
   * 셋을 **늘 함께** 낸다. 실제로 완성되는 것만 남기면(`해운대` → `구` 하나)
   * 그날 답의 접미사를 알려 주는 셈이 된다. 시인지 군인지 구인지는 이 게임이
   * 묻는 지식이라 거기까지는 안 준다. 주는 것은 형식뿐이다.
   */
  const completable = useMemo(() => {
    const typed = input.trim();
    if (typed === "") return false;
    if (regions.some((r) => r.name === typed || r.aliases?.includes(typed))) return false;
    return SUFFIXES.some((x) => regions.some((r) => r.name === typed + x));
  }, [input, regions]);

  const pickSido = (code: string) => {
    setNote(null);
    put({ ...state, sidoPicks: [...state.sidoPicks, code] });
  };

  /** 접미사 단추가 부를 때는 그 값을 넘긴다. 상태가 아직 안 반영됐을 수 있다. */
  const submit = (raw: string = input) => {
    const typed = raw.trim();
    if (typed === "" || stage !== "region") return;

    const matches = regions.filter(
      (r) => r.name === typed || r.aliases?.includes(typed),
    );
    if (matches.length === 0) {
      setNote("없는 이름입니다");
      setRejected((n) => n + 1);
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
  const text = quizShareText(state);
  /*
   * 미리보기용으로 문구를 색 줄 앞뒤로 가른다. 그 줄은 본문 안에 그대로
   * 들어 있으므로 그것을 경계로 자른다 — 두 벌을 따로 만들면 보여 준 것과
   * 보낸 것이 언젠가 갈라진다.
   */
  const marks = state.guesses.map((g) => QUIZ_EMOJI[g.closeness]).join("");
  const markAt = marks ? text.indexOf(marks) : -1;
  const head = (markAt >= 0 ? text.slice(0, markAt) : text).trim();
  const tail = markAt >= 0 ? text.slice(markAt + marks.length).trim() : "";

  /*
   * 아직 안 푼 사람에게 보이는 숫자.
   *
   * 끝난 뒤에 보여 주는 것은 결과지만, 시작 전에 보여 주는 것은 **오늘 풀 이유**다.
   * 어제까지 이어 온 사람이 그 숫자를 보고 들어온다.
   *
   * 저장된 값이 아니라 오늘 기준으로 살아 있는지를 본다 — 이틀 쉬었으면 저장된
   * 숫자는 그대로여도 지금은 끊긴 상태다.
   */
  /*
   * 자판을 열어 둔다.
   *
   * `autoFocus`만 걸어 두었는데 그것으로는 모자랐다. 그 속성은 붙는 순간
   * 한 번뿐이라, 시도를 맞히고 입력창이 나타난 뒤에도 답을 낼 때마다 초점이
   * 흩어졌다 — 제출을 손으로 누르면 초점이 단추로 가고, 그 다음 답을 치려면
   * 매번 입력창을 다시 눌러야 했다.
   *
   * 그래서 단계가 바뀔 때와 답이 하나 쌓일 때마다 되돌린다. 판이 끝나면
   * 놓아 준다 — 끝난 화면에서 자판이 올라와 있으면 결과를 가린다.
   */
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (stage === "region") inputRef.current?.focus();
  }, [stage, state.guesses.length, rejected]);

  const alive = streak ? aliveOn(streak, day) : 0;

  return (
    <div className="flex w-full flex-col gap-5">
      {/*
        한 줄이다.

        이름·날짜·이어 온 날이 세 줄로 쌓여 있었다. 셋 다 짧아서 한 줄에 다
        들어가는데, 세로로 두면 지도가 그만큼 아래로 밀린다. 이 화면의 본체는
        지도다.

        불꽃을 페이지 쪽 머리글로 못 올린다. 판을 끝내는 순간 하루치가 세어져
        숫자가 오르는데, 서버 컴포넌트에 두면 그때 안 따라온다.
      */}
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-4xl font-bold tracking-tight">오늘의 퀴즈</h1>
        <p className="font-mono text-sm text-dim">{quizDate(day)}</p>
        {alive > 1 && <StreakBadge days={alive} />}
      </header>

      {/*
        본편과 같은 구조로 둔다.

        한때 반대로 짰다 — 전국 어디쯤인가가 이 퀴즈의 단서 자체라 큰 지도를
        당기면 안 된다고 보고, 대신 구석에 확대 창을 하나 얹었다. 그런데 그건
        같은 화면에 돋보기를 덧댄 꼴이라 어느 쪽을 봐야 하는지가 흐려졌고,
        이 사이트의 다른 판과도 혼자 다르게 생겼다.

        본편은 이 문제를 진작 풀어 두었다. 큰 지도는 문제인 곳으로 당기고,
        전체 안에서 어디인가는 미니맵이 맡는다. 잃는 것 없이 둘 다 얻는
        구조이고, 무엇보다 사용자가 이미 아는 화면이다.
      */}
      <div className="relative w-full">
        <RegionMap
          geo={geo}
          variant="hint"
          currentCode={answerCode}
          namedCodes={namedCodes}
          /*
           * 못 맞히고 끝난 판에서는 정답을 **빨강으로** 칠한다.
           *
           * 현재 지역 색(밝은 초록)으로 두면 화면이 "여기가 정답이고 너는
           * 맞혔다"로 읽힌다. 빨강과 빗금은 이 사이트에서 이미 `다시 볼 곳`이라는
           * 뜻이고, 못 맞힌 판의 정답이 정확히 그것이다.
           *
           * 판이 끝나면 이름을 짚어 볼 수 있게 연다. 그 전에는 안 된다 —
           * 짚는 순간 이름이 뜨고 그게 곧 답이다.
           */
          missedCodes={stage === "done" && !state.solved ? [answerCode] : undefined}
          explore={stage === "done"}
          /*
           * 카메라가 질문을 따라간다.
           *
           * 처음부터 정답 지역으로 당겨 두었었다. 그런데 1단계가 묻는 것은
           * `어느 시도인가`이고 그 답을 주는 것은 큰 지도가 아니라 구석의
           * 미니맵이었다 — 큰 지도는 아직 필요 없는 것을 보여 주고, 필요한
           * 것은 20px짜리 창이 맡고 있었다.
           *
           * 그래서 시도를 맞혀도 화면이 안 변했다. 변할 것이 없었다.
           *
           * 이제 1단계는 전국을 펴 놓고 문제인 곳만 켠다(`어디쯤인가`),
           * 맞히면 그 곳으로 들어간다(`이 모양은 무엇인가`). **카메라가
           * 움직이는 것 자체가 맞혔다는 신호다.** 따로 축하 문구를 놓지
           * 않아도 되고, 각 단계는 그 질문에 필요한 것만 보여 준다.
           */
          focus={stage !== "sido"}
          /*
           * 폭은 다 쓰고 높이만 잡는다.
           *
           * `w-auto`로 두면 창의 모양을 지도 파일이 정한다 — 전국 지도의
           * viewBox는 울릉이 동쪽 끝을, 서귀포가 남쪽 끝을 밀어 935×1001,
           * 거의 정사각형이다. 본토는 그런 모양이 아닌데 창만 정사각형이라
           * 지도가 네모 칸에 끼인 것처럼 보였다.
           *
           * 어차피 카메라가 당기고 있으므로 창의 비율은 지도 파일과 아무
           * 상관이 없다. 넓힌 만큼 좌우로 이웃이 더 들어오고, 이 퀴즈에서
           * 이웃은 곧 단서다.
           */
          className="h-[38vh] max-h-[26rem] w-full"
        />

        {/*
          전체 지도. 배경을 깔아 준다 — 같은 회색 위에 얹으면 지도가 아니라
          얼룩으로 보인다.

          왼쪽 위에 둔다. 오른쪽 위는 강원 동해안이라, 하필 그 근처가 답인 날에
          답을 가린다. 왼쪽 위는 서해뿐이다.
        */}
        {/*
          큰 지도가 전국을 펴 놓은 동안에는 미니맵이 같은 그림을 작게 한 번 더
          그리는 꼴이다. 카메라가 들어간 뒤부터 맡을 일이 생긴다.
        */}
        {stage !== "sido" && (
        <span className="pointer-events-none absolute top-0 left-0 border border-edge bg-paint px-1.5 py-1">
          <MiniMap
            geo={geo}
            currentCode={answerCode}
            namedCodes={namedCodes}
            className="size-20 sm:size-24"
          />
        </span>
        )}
      </div>

      {/* 낸 답들. 색이 곧 공유될 격자다. */}
      {state.guesses.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {state.guesses.map((g, i) => (
            <li
              key={`${g.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-edge px-4 py-2.5"
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
                  className="rounded-lg border border-edge px-4 py-2.5 font-medium transition-colors hover:bg-concrete-deep disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
          {/*
            남은 횟수를 칸으로 보인다.

            `2번 남음`이라고 적고 있었다. 그건 셀 수 있는 것을 글로 옮긴 것이고,
            칸 여섯을 늘어놓으면 몇 칸이 남았는지가 세지 않아도 보인다. 채워진
            칸의 색은 공유될 격자와 같은 색이라, 무엇이 나가는지도 여기서 미리
            읽힌다.

            `어느 시군구입니까`도 걷었다. 지도에 한 곳이 켜져 있고 그 아래
            입력칸이 있으면 무엇을 하라는 것인지 문장 없이 읽힌다. 시도 단계의
            물음은 남긴다 — 거기는 선택지가 열일곱 개라 무엇을 고르는 목록인지
            말해 주지 않으면 지도와 이어지지 않는다.

            없는 이름을 냈을 때 여기가 한 번 반응한다. 안 깎였다는 것을 안
            깎인 칸이 스스로 말한다.
          */}
          <p
            key={rejected}
            className={`flex gap-1.5 ${rejected > 0 ? "tally-hold" : ""}`}
            role="status"
            aria-label={`${left}번 남았습니다`}
          >
            {Array.from({ length: MAX_TRIES }, (_, i) => {
              const g = state.guesses[i];
              return (
                <span
                  key={i}
                  aria-hidden
                  className={`h-2.5 w-6 rounded-xs ${
                    g
                      ? g.closeness === "hit"
                        ? "bg-sign"
                        : g.closeness === "near"
                          ? "bg-centerline"
                          : "bg-alert"
                      : "border border-edge"
                  }`}
                />
              );
            })}
          </p>
          {/*
            물린 답은 **입력칸이 말한다.** 아래에 뜨는 한 줄은 눈이 이미
            지나간 자리에 있어서, 친 사람은 자기가 친 글자를 보고 있다.
            표지판이 오답에 쓰는 흔들림을 그대로 가져온다.

            `key`로 다시 붙여 애니메이션을 되감는다 — 클래스를 껐다 켜는
            것으로는 두 번째부터 안 돈다. 그래서 초점이 날아가므로 아래
            `useEffect`가 `rejected`까지 보고 되돌린다.
          */}
          <div
            key={`shake-${rejected}`}
            className={`flex gap-2 ${rejected > 0 ? "plate-shake" : ""}`}
          >
            <label className="sr-only" htmlFor="guess">
              시군구 이름
            </label>
            <input
              id="guess"
              ref={inputRef}
              value={input}
              /* 고치기 시작하면 물렸다는 표시는 사라진다. 손대는 중에 빨간 테두리가 남아 있으면 그것도 지금 상태로 읽힌다. */
              onChange={(e) => {
                setInput(e.target.value);
                if (note) setNote(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={sample}
              className={`flex-1 rounded-lg border bg-paint px-4 py-3 text-ink placeholder:text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                note ? "border-alert" : "border-edge"
              }`}
            />
            <button
              type="button"
              onClick={() => submit()}
              className="rounded-lg bg-sign px-5 py-3 font-medium whitespace-nowrap text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              제출
            </button>
          </div>

          {/*
            친 이름을 그대로 두고 끝만 고른다.

            `이름 끝까지 씁니다`라고 적어 두었었는데, 그건 사실을 말하는 것이
            아니라 시키는 말이라 건방지다. 시킬 것이 있으면 시키는 대신
            누를 것을 준다.
          */}
          {completable && (
            <div className="flex gap-2">
              {SUFFIXES.map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => {
                    const full = input.trim() + suffix;
                    setInput(full);
                    submit(full);
                  }}
                  className="rounded-lg border border-edge px-4 py-2 font-mono text-base transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {input.trim()}
                  <span className="font-bold text-ink">{suffix}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {note && (
        <p className="font-mono text-sm text-alert" role="status">
          {note}
        </p>
      )}

      {stage === "done" && (
        <section className="flex flex-col gap-4 rounded-xl border border-edge bg-paint p-5">
          {/*
            맞힌 판과 못 맞힌 판이 같은 모양이면, 이름만 보고 자기가 맞혔는지를
            다시 헤아려야 한다. 못 맞혔을 때만 `정답`이라는 딱지를 앞에 붙인다.

            위로도 설명도 안 붙인다. `아쉽네요, 다시 도전해보세요`는 숫자가 이미
            하는 말을 문장으로 한 번 더 하는 것이고, 그 문장은 아무도 안 읽는다.
          */}
          <div className="flex items-baseline justify-between gap-4">
            <p className="flex items-baseline gap-2.5">
              {!state.solved && (
                <span className="font-mono text-sm text-alert">정답</span>
              )}
              {/*
                시도는 여기서만 적는다. 공유에는 안 나간다 — 받는 사람이 첫
                질문의 답을 알고 시작하면 반쯤 풀린 판을 물려받는 셈이다.
              */}
              {sidoName && (
                <span className="font-mono text-sm text-dim">{sidoName}</span>
              )}
              <span className="text-2xl font-bold">{answer.name}</span>
            </p>
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
            /*
              그림은 지도를 안 싣는다. 결과 화면의 도전장 카드를 재활용하면 그림
              한 장이 오늘 문제를 통째로 알려 준다 — 받은 사람이 풀 거리가
              사라지면 오늘의 퀴즈라는 형식이 무너진다. 색 블록만 나간다.
            */
            imagePath={`/api/today-card/${cardCode(state)}`}
            preview={
              /*
                보낼 것을 그대로 보여 준다. 색 줄만 크게 둔다 — 그게 이
                공유물의 본체이고, 나머지는 그것을 둘러싼 문장이다.
              */
              <div
                aria-hidden
                className="flex flex-col items-center gap-2 text-center text-[11px] text-dim sm:text-xs"
              >
                <pre className="whitespace-pre-wrap">{head}</pre>
                <pre className="text-lg leading-none whitespace-pre">
                  {state.guesses.map((g) => QUIZ_EMOJI[g.closeness]).join("")}
                </pre>
                <pre className="whitespace-pre-wrap">{tail}</pre>
              </div>
            }
            tweet={text}
            kakao={{
              title: `오늘의 퀴즈 ${quizDate(day)}`,
              // 카드에도 시도를 안 적는다. 받는 사람이 첫 질문의 답을 알고 시작한다.
              description: `${
                state.solved ? `${state.guesses.length} / ${MAX_TRIES}` : `X / ${MAX_TRIES}`
              }, 같이 한 판?`,
            }}
          />

          {/*
            하루에 한 번인 게임에서 "끝"만 적으면 오늘 여기서 관계가 끊긴다.
            그 자리에 문장을 두는 대신 값을 둔다 — 줄어드는 시계.

            이어 온 날은 여기 없다. 머리글이 늘 들고 있고, 판을 끝내는 순간
            거기 숫자가 오른다. 한 화면에 불꽃이 둘일 이유가 없다.
          */}
          <p className="flex flex-wrap items-baseline gap-x-4 font-mono text-sm text-dim">
            <NextQuiz />
          </p>
        </section>
      )}
    </div>
  );
}

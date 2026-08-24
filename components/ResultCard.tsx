"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { classifyWrongAnswer, type PeerName } from "@/lib/score/confusion";
import type { ItemResult, Score } from "@/lib/game/types";
import { formatClock } from "./Odometer";
import { RegionMap } from "./RegionMap";
import type { Challenge } from "@/lib/game/challenge";
import { spokenDuration } from "@/lib/share/grid";

interface ResultCardProps {
  courseName: string;
  modeLabel: string;
  score: Score;
  /**
   * 이 판에서 자랑할 숫자가 시간인지 개수인지.
   *
   * 시간 제한이 있는 모드는 모두가 같은 60초를 쓰므로 시간이 성적이 아니다.
   * 거기서는 "몇 곳"이 성적이고, 나머지 모드에서는 "몇 초"가 성적이다.
   */
  emphasis?: "time" | "count";
  /** 코스 지도. 없으면 지도를 생략한다. */
  geo?: CourseGeo | null;
  /** 실제로 맞힌 지역 코드 */
  passedCodes?: string[];
  /** 맞히긴 했지만 헤맨 곳. 지도에서 노랑으로 뜬다. */
  struggledCodes?: string[];
  /** 도전장을 받고 온 판이면 그 기록. 끝난 자리에서 대조한다. */
  challenge?: Challenge | null;
  /** 한 번에 못 간 곳 전부 — 헤맨 곳과 못 맞힌 곳. `markOf()`로 가른다. */
  missed?: ItemResult[];
  /** 랭킹 등록 영역. 결과 카드는 제출 방식을 몰라도 된다. */
  submitSlot?: ReactNode;
  /** 자랑하기 영역 */
  shareSlot?: ReactNode;
  /** 틀린 곳만 다시 푸는 자리. 있으면 이쪽이 주 버튼이 된다. */
  reviewSlot?: ReactNode;
  /** 다른 코스를 고르러 갈 주소 */
  coursesHref: string;
  /** 개인 최고 기록 영역 */
  bestSlot?: ReactNode;
  /** 다음 판으로 넘기는 영역 */
  nextSlot?: ReactNode;
  onRestart: () => void;
}

/** 초 단위까지. 0.01초 차이로 갱신되는 재미가 여기서 나온다. */
function formatPrecise(ms: number): string {
  return `${formatClock(ms)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;
}

/**
 * 도전장을 이겼는가.
 *
 * 여태 도전 정보는 카운트다운까지만 살아 있었다. 목표를 보며 시작했는데
 * 끝나고 나면 화면이 아무 말도 안 했다 — 이겼는지 졌는지를 사람이 직접 두
 * 숫자를 빼서 알아내야 했다.
 *
 * 공유가 한 방향에서 왕복이 되는 자리가 여기다. 이겼다는 한 줄이 있어야 받은
 * 사람이 되쏘고, 그 아래에 공유 단추가 이미 있다. 진 경우에도 적는다 — 얼마나
 * 모자랐는지가 다시 할 이유이고, 숨기면 그냥 안 알려 주는 화면이 된다.
 */
function Verdict({ challenge, score }: { challenge: Challenge; score: Score }) {
  const diff = challenge.beatMs - score.elapsedMs;
  const won = diff > 0;
  const gap = spokenDuration(Math.abs(diff));
  const who = challenge.by;

  return (
    <p
      className={`relative mt-3 font-mono text-sm ${
        won ? "font-semibold text-sign-accent" : "text-on-sign/70"
      }`}
      role="status"
    >
      {who
        ? won
          ? `${who}님을 ${gap} 앞섰습니다`
          : `${who}님에게 ${gap} 뒤졌습니다`
        : won
          ? `받은 기록보다 ${gap} 빠릅니다`
          : `받은 기록보다 ${gap} 느립니다`}
    </p>
  );
}


/**
 * 도착 표지판.
 *
 * 순서가 이 화면의 전부다. 판이 끝난 직후 가장 센 충동은 "한 번 더"이고,
 * 그 다음이 "자랑"이다. 예전에는 지도 → 기록 → 통계 → 추천 → 랭킹을 다
 * 지나야 다시 달리기 버튼이 나왔다. 그 사이에 충동이 식는다.
 *
 * 지금 순서: 성적 → 한 번 더 → 기록 비교 → 자랑 → 랭킹 → 다시 볼 곳 →
 * 지도 → 상세 → 다음 단계.
 */
export function ResultCard({
  courseName,
  modeLabel,
  score,
  emphasis = "time",
  geo,
  passedCodes = [],
  struggledCodes = [],
  challenge = null,
  missed = [],
  submitSlot,
  shareSlot,
  reviewSlot,
  bestSlot,
  nextSlot,
  coursesHref,
  onRestart,
}: ResultCardProps) {

  /*
    착각의 상대가 될 수 있는 후보. 같은 코스의 다른 지역 이름들이다.
    지도가 없는 코스에서는 가릴 방법이 없으므로 아예 안 적는다.
  */
  /*
    바로 간 곳.

    `score.firstTry`(첫 제출에 맞힌 수)를 쓰지 않는다. 판정 모드에 따라 그
    값이 지도와 갈리기 때문이다 — `live`에서는 제출이라는 개념이 없어
    `attempts`가 늘 1이라 오타를 낸 곳도 첫 제출로 세어진다. 지도와 이모지
    격자를 가르는 `markOf`가 이 화면의 기준이고, 범례도 그것을 따라야 한다.
  */
  const cleanCount = score.completed - struggledCodes.length;

  const peers: PeerName[] = useMemo(
    () => (geo ? geo.regions.map((r) => ({ name: r.name })) : []),
    [geo],
  );
  const perfect = score.completed === score.total;
  const shown = useCountUp(score.elapsedMs);

  return (
    /*
     * 넓은 화면에서는 두 단으로 나눈다.
     *
     *   왼쪽  무엇을 했는가 — 지도와 다시 볼 곳
     *   오른쪽 어떻게 했는가 — 기록, 그리고 이제 뭘 할지
     *
     * 한 줄로 쌓아 두었더니 기록은 위, 지도는 아래에서 따로 놀았다. 지도
     * 보고 맞히는 게임의 결과 화면에서 지도는 장식이 아니라 결과의 본체다.
     * 좁은 화면에서는 기록 → 지도 → 다음 순서로 흐른다.
     */
    <div className="flex w-full max-w-5xl flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
      <section className="order-2 flex flex-col gap-3 md:order-none md:col-start-1 md:row-span-2 md:row-start-1">
        {geo && (
          <div className="result-map flex flex-col items-center gap-2">
            <RegionMap
              geo={geo}
              passedCodes={passedCodes}
              struggledCodes={struggledCodes}
              missedCodes={missed.filter((r) => r.skipped).map((r) => r.id)}
              variant="route"
              /*
               * 판이 끝난 뒤에는 이름을 가릴 이유가 없다. 오히려 여기가 짚어
               * 보기 가장 좋은 자리다 — 빨간 곳이 어디였는지 손으로 확인한다.
               */
              explore
              /*
                근데 데스크톱에서 왼쪽 아래가 통째로 비었다. 오른쪽 칸은
                성적부터 공유까지 길게 이어지는데 왼쪽은 지도와 목록에서
                끝나 무게중심이 오른쪽으로 쏠린다.

                채울 것을 새로 만들지 않는다. 이 화면에서 지도는 장식이
                아니라 결과의 본체이므로, 남는 세로를 지도가 쓰면 된다.
              */
              className="h-56 w-auto max-w-full sm:h-72 md:h-[34rem]"
            />
            {/*
              한 종류밖에 없으면 그건 범례가 아니라 설명문이다. 다 맞힌 판에서
              초록이 무엇인지 알려 줄 이유가 없다 — 지도 자체가 결과다.
              섞였을 때만, 두 상태를 나란히 놓는다. 색만으로 가르면 색을
              구분하기 어려운 사람에게는 아무 말도 아니므로 빗금도 함께 쓴다.
            */}
            {(missed.some((r) => r.skipped) || struggledCodes.length > 0) && (
              <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-sm text-dim">
                <Legend color="var(--color-sign)" label={`바로 맞힘 ${cleanCount}`} />
                {struggledCodes.length > 0 && (
                  <Legend
                    dotted
                    color="var(--color-centerline)"
                    label={`헤매다 맞힘 ${struggledCodes.length}`}
                  />
                )}
                {missed.some((r) => r.skipped) && (
                  <Legend
                    hatched
                    color="var(--color-alert)"
                    /*
                      `다시 볼 곳`이라고 적었었다. 그런데 바로 아래 상자
                      이름도 `다시 볼 곳`인데 그쪽은 노랑까지 세므로, 같은
                      말이 한 화면에서 다른 숫자를 가리켰다. 범례의 셋은
                      배타적이어야 하고 합이 코스 전체여야 한다.
                    */
                    label={`못 맞힘 ${missed.filter((r) => r.skipped).length}`}
                  />
                )}
              </span>
            )}
          </div>
        )}

        {/*
          지도만으로는 회색이 어디인지 이름으로 읽히지 않는다. 모르겠다고
          넘긴 사람이 정말 알고 싶은 것은 "그래서 거기가 어디였나"이고,
          그 답이 지도 바로 아래 붙어 있어야 두 개가 한 장면이 된다.
        */}
        {missed.length > 0 && (
          <section className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border border-edge bg-paint p-5 md:max-w-none">
            <h2 className="text-sm font-medium text-dim">
              다시 볼 곳 {missed.length}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {missed.map((r) => {
                /*
                  무엇으로 **착각했는지**만 적는다.

                  여태 제출된 오답을 그대로 붙였더니 `광주 → 과주라고 답함`이
                  떴다. 과주는 지명이 아니라 손이 미끄러진 자국이고, 그걸
                  적어 주는 것은 틀렸다는 통보를 한 번 더 하는 일이다.

                  안산을 연천이라고 답한 것은 다르다. 그 사람에게 필요한 것은
                  두 곳을 나란히 보는 일이다. 가르는 규칙은 이미 있다
                  (lib/score/confusion.ts) — 오답노트가 홈에 `도봉구 ↔ 도봉그`를
                  띄우지 않으려고 쓰던 것과 같은 판정이다.
                */
                const confused = peers.length
                  ? (r.wrongAnswers ?? [])
                      .map((wrong) => classifyWrongAnswer(wrong, r.answer, peers))
                      .filter((name): name is string => !!name)
                  : [];
                return (
                  <li
                    key={r.id}
                    /*
                      칩 모양은 하나다. 끝까지 못 맞힌 곳과 틀렸다가 맞힌 곳을
                      여기서 또 가르면, 지도와 범례가 이미 하는 말을 세 번째로
                      하는 셈이다. 이 상자가 하는 말은 `다시 볼 곳`뿐이다.
                    */
                    className="rounded-lg bg-alert/10 px-3 py-1.5 text-base text-alert"
                  >
                    {r.answer}
                    {confused.length > 0 && (
                      <span className="ml-1.5 text-sm text-alert/70">
                        → {confused.join(", ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </section>

      {/*
        기록은 한 덩어리다. 성적·해석·코스명이 서로 다른 자리에서 같은 크기로
        경쟁하면 무엇이 이 판의 성적인지 읽히지 않는다.

        입체감은 덜어 냈다. 이 서비스의 맛은 화려함이 아니라 관공서스럽고
        건조한데 게임이 되는 데 있다. 표지판이라는 정체성은 남기고 두께만
        줄인다 — 판면이 주인공인 곳은 플레이 화면이다.
      */}
      <div className="result-card sign-face relative order-1 rounded-lg px-8 py-8 text-center shadow-[0_2px_0_0_var(--color-sign-deep)] md:order-none md:col-start-2 md:row-start-1">
        {/*
          안쪽 흰 선. 고속도로 표지판의 문법이다.

          곡률을 12px에서 6px로 낮췄다. 둥글면 판이 아니라 앱 카드로 읽힌다 —
          실제 표지판의 안쪽 선은 곡률이 아주 살짝만 있다.

          두께는 2px를 지킨다. 3px로 키워 보니 선이 글씨보다 굵어져 주인공이
          바뀐다 — 실물에서도 안쪽 선은 글자 획보다 살짝 얇다.
        */}
        <div className="pointer-events-none absolute inset-2.5 rounded-md border-2 border-on-sign/80" />
        {/*
          코스명이 맨 위다.
          한때 `완주`가 이 자리에서 제일 컸다 — 숫자만 크면 끝냈다는 감정이
          안 남는다는 이유였다. 그때는 이 판을 견줄 것이 화면에 없었다. 지금은
          개인 기록 비교와 도전장 대조가 감정을 대신 만들어 주므로, `완주`는
          상태 줄로 내려가도 된다. 결과에서 먼저 알고 싶은 것은 무엇을 얼마에
          했는가다.

          작은 글씨를 없앴다. 코스명이 text-sm, 힌트가 text-xs로 표지판 위에
          깨알처럼 얹혀 있었다 — 표지판은 멀리서 읽는 물건이다.
        */}
        <p className="relative text-2xl font-bold tracking-tight text-on-sign">
          {courseName}
        </p>

        {/*
          다 맞히지 못한 판에서는 시간이 성적이 아니다.
          열일곱 중 열여섯을 맞힌 사람에게 필요한 말은 "몇 초"가 아니라
          "열여섯 곳"이다. 한 곳을 몰랐다고 해서 그 판에 한 일이 없어지지
          않는다 — 성취를 무효로 만들면 다시 할 이유도 함께 사라진다.
        */}
        {emphasis === "time" && perfect ? (
          <p className="relative mt-3 font-mono text-5xl font-bold tabular-nums text-on-sign">
            {formatPrecise(shown)}
          </p>
        ) : (
          <p className="relative mt-3 text-5xl font-bold text-on-sign">
            {score.completed}
            <span className="ml-1 text-2xl font-medium text-on-sign/70">
              / {score.total}
            </span>
          </p>
        )}

        {/*
          상태 한 줄. 무엇을 어떻게 끝냈는가.

          모드를 남겨 둔다. `이름 보고 익히기`로 낸 기록은 랭킹에도 개인 기록에도
          안 올라가므로, 같은 숫자라도 다른 판이다.
        */}
        <p className="relative mt-3 flex flex-wrap items-baseline justify-center gap-x-3 font-mono text-base text-on-sign/75">
          <span>{perfect ? "완주" : "도착"}</span>
          <span>{modeLabel}</span>
        </p>

        {/*
          힌트만 남는다.

          여기에 `바로 맞힘 16 / 18`이 있었다. 이름을 세 번 고치고 나서야
          이름이 문제가 아니라는 게 보였다 — **지도 바로 아래 범례가 같은 값을
          색깔까지 붙여 이미 말하고 있다.** 표지판에서 한 번 더 세는 것은
          `오타`를 뺀 것과 같은 이유로 뺀다.

          게다가 완주하지 못한 판에서는 위에 `16 / 18`(끝낸 곳)이 뜨는데, 그
          바로 아래 `바로 맞힘 16 / 18`이 붙으면 같은 꼴의 분수 둘이 다른
          것을 세게 된다.

          힌트는 남긴다. 이건 이 판이 순위에 오를 수 있는지를 가르는 값이라
          범례가 대신 말해 주지 않는다. 쓴 판에만 적는다.
        */}
        {score.hintsUsed > 0 && (
          <p className="relative mt-1 font-mono text-base text-on-sign/75">
            {`힌트 ${score.hintsUsed}회`}
          </p>
        )}

        {/* 다 돌지 못한 판에서는 시간이 위에 없으므로 여기 적는다. */}
        {!(emphasis === "time" && perfect) && (
          <p className="relative mt-1 font-mono text-base text-on-sign/75">
            {formatPrecise(score.elapsedMs)}
          </p>
        )}

        {challenge &&
          (emphasis === "time" && perfect ? (
            <Verdict challenge={challenge} score={score} />
          ) : (
            /*
              다 돌지 못한 판에는 승패를 매기지 않는다. 스물다섯 중 스물만 치고
              빨랐다고 이겼다고 하면 그건 거짓말이다. 목표만 남긴다.
            */
            <p className="relative mt-3 font-mono text-base text-on-sign/70">
              목표 {formatPrecise(challenge.beatMs)}
            </p>
          ))}

        {/*
          기록 해석은 기록에 붙어 있어야 한다. 카드 밖에 한 줄로 떼어 놓았을
          때는 정보량에 비해 자리만 먹고 혼자 떠 있었다.
        */}
        {bestSlot && <div className="relative mt-4">{bestSlot}</div>}

        {/*
          `4곳은 다음에 만나요`가 있었다. 문법은 멀쩡한데 말투가 혼자 달랐다 —
          이 사이트의 다른 문구는 지도책 캡션에 가깝게 담백한데 여기만
          어린이 앱 톤이었다. 게다가 바로 위의 `16 / 25`가 이미 같은 말이다.
        */}
      </div>

      <div className="order-3 flex flex-col gap-3 md:order-none md:col-start-2 md:row-start-2">
        {/*
          하나만 세게 민다. 판이 끝난 직후 가장 센 충동은 "한 번 더"이고,
          다섯 개를 같은 무게로 늘어놓으면 다 끝낸 순간에 메뉴를 다시 읽게
          된다. 다만 못 맞힌 곳이 있으면 그쪽이 먼저다 — 열일곱 중 셋을
          몰랐는데 열일곱을 다시 도는 것보다 그 셋을 보는 편이 배우는 데도
          빠르고 부담도 적다.
        */}
        {reviewSlot}

        <button
          type="button"
          onClick={onRestart}
          className={`rounded-lg px-5 py-4 text-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
            reviewSlot
              ? "border border-edge text-ink hover:bg-concrete-deep"
              : "bg-sign text-on-sign hover:bg-sign-deep"
          }`}
        >
          {reviewSlot ? "전체 다시 하기" : "한 번 더"}
        </button>

        {/*
          `다른 코스`였다. 위의 둘은 동사로 끝나는데(`연습`, `다시 하기`) 이것만
          명사라 눌리는 것으로 안 읽혔다.

          `다른 지역 연습하기`로 하자는 말이 있었는데 안 쓴다. 이 제품에서
          `지역`은 시군구 하나를 가리키고, 그 말을 코스에 쓰면 두 단위가 한
          화면에서 같은 이름을 갖는다. 그리고 이 버튼은 바로 시작하지 않고
          목록으로 가므로, 동사는 `고르기`가 맞다.
        */}
        <Link
          href={coursesHref}
          className="rounded-lg border border-edge px-5 py-3 text-center font-medium text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          다른 코스 고르기
        </Link>

        {/*
          여기부터는 하려는 사람만 본다. 선을 하나 긋고 무게를 낮춘다.
          경쟁이 축인 모드에서는 순서를 뒤집는다 — 타임어택을 한 사람에게
          먼저 필요한 것은 공유가 아니라 순위다.
        */}
        {(shareSlot || submitSlot || nextSlot) && (
          <div className="flex flex-col gap-3 border-t border-edge pt-5">
            {emphasis === "count" ? (
              <>
                {submitSlot}
                {shareSlot}
              </>
            ) : (
              <>
                {submitSlot}
                {shareSlot}
              </>
            )}
            {nextSlot}
          </div>
        )}

        {/*
          여기 `자세히 보기` 상자가 있었다. 맞힌 타수, 오타, 첫 입력, 힌트
          넷을 접어 두었는데, 뒤의 둘은 바로 위 표지판이 이미 말하고 있었고
          앞의 둘도 열 이유가 못 됐다 — 맞힌 타수는 완주한 지역들의 이름 길이
          합이라 코스가 정해지면 거의 상수이고(랭킹에서 타수를 순위에 안 쓰는
          이유가 그것이다), 타/분 없이 타수만으로는 잘 친 건지도 알 수 없다.

          접어 둔 것이 문제가 아니라 안에 든 것이 문제였다. 오타만 위로
          올리고 상자를 걷는다. 잃은 값은 없다.
        */}
      </div>
    </div>
  );
}

/**
 * 기록 숫자가 짧게 올라간다.
 *
 * 판이 끝나는 순간 화면이 아무 일도 하지 않으면 정적인 관리 페이지처럼
 * 읽힌다. 다만 축포는 이 톤과 맞지 않는다 — 숫자가 제 값까지 0.5초 동안
 * 차오르는 정도면 충분하다.
 *
 * 움직임을 원치 않는 사람에게는 처음부터 제 값이다.
 */
function useCountUp(target: number, ms = 500): number {
  const [value, setValue] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? target
      : 0,
  );

  useEffect(() => {
    if (value === target) return;
    const started = performance.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - started) / ms);
      // 끝에서 부드럽게 멈춘다. 일정한 속도로 올라가면 기계처럼 보인다.
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // 결과가 확정된 뒤 한 번만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

function Legend({
  color,
  label,
  hatched = false,
  dotted = false,
}: {
  color: string;
  label: string;
  hatched?: boolean;
  dotted?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {/*
        색 견본에도 지도와 같은 무늬를 넣는다. 범례와 지도가 다른 그림이면
        범례가 오히려 헷갈리게 한다.
      */}
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{
          backgroundColor: color,
          backgroundImage: hatched
            ? "repeating-linear-gradient(45deg, transparent 0 2px, var(--color-paint) 2px 4px)"
            : dotted
              ? "radial-gradient(var(--color-paint) 0.9px, transparent 1px)"
              : undefined,
          backgroundSize: dotted ? "4px 4px" : undefined,
        }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

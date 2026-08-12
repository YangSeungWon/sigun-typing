"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { CourseGeo } from "@/data/geo/types";
import type { ItemResult, Score } from "@/lib/game/types";
import { formatClock } from "./Odometer";
import { RegionMap } from "./RegionMap";

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
  /** 못 맞혔거나 틀린 채로 지나온 항목 */
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-concrete-deep py-3">
      <span className="text-base text-dim">{label}</span>
      <span className="font-mono text-2xl tabular-nums text-ink">{value}</span>
    </div>
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
  missed = [],
  submitSlot,
  shareSlot,
  reviewSlot,
  bestSlot,
  nextSlot,
  coursesHref,
  onRestart,
}: ResultCardProps) {
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
              missedCodes={missed.filter((r) => r.skipped).map((r) => r.id)}
              variant="route"
              /*
               * 판이 끝난 뒤에는 이름을 가릴 이유가 없다. 오히려 여기가 짚어
               * 보기 가장 좋은 자리다 — 빨간 곳이 어디였는지 손으로 확인한다.
               */
              explore
              className="h-56 w-auto sm:h-72 md:h-[26rem]"
            />
            {/*
              한 종류밖에 없으면 그건 범례가 아니라 설명문이다. 다 맞힌 판에서
              초록이 무엇인지 알려 줄 이유가 없다 — 지도 자체가 결과다.
              섞였을 때만, 두 상태를 나란히 놓는다. 색만으로 가르면 색을
              구분하기 어려운 사람에게는 아무 말도 아니므로 빗금도 함께 쓴다.
            */}
            {missed.some((r) => r.skipped) && (
              <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-sm text-dim">
                <Legend color="var(--color-sign)" label={`맞힘 ${score.completed}`} />
                <Legend
                  hatched
                  color="var(--color-alert)"
                  label={`다시 볼 곳 ${missed.filter((r) => r.skipped).length}`}
                />
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
          <section className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border border-concrete-deep bg-paint/60 p-5">
            <h2 className="text-sm font-medium text-dim">
              다시 볼 곳 {missed.length}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {missed.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-lg px-3 py-1.5 text-base ${
                    r.skipped
                      ? "bg-alert/10 text-alert"
                      : "border border-concrete-deep text-ink"
                  }`}
                >
                  {r.answer}
                  {/*
                    무엇으로 착각했는지가 "오타 1회"보다 훨씬 쓸모 있다.
                    안산을 연천이라고 답한 사람에게 필요한 것은 그 두 곳을
                    나란히 보는 일이지, 자기가 틀렸다는 통보가 아니다.
                  */}
                  {r.wrongAnswers && r.wrongAnswers.length > 0 ? (
                    <span className="ml-1.5 text-sm text-dim">
                      → {r.wrongAnswers.join(", ")}라고 답함
                    </span>
                  ) : (
                    !r.skipped && <span className="ml-1.5 text-sm text-dim">오타</span>
                  )}
                </li>
              ))}
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
      <div className="result-card sign-face relative order-1 rounded-2xl px-8 py-8 text-center shadow-[0_2px_0_0_var(--color-sign-deep)] md:order-none md:col-start-2 md:row-start-1">
        <div className="pointer-events-none absolute inset-2.5 rounded-xl border-2 border-paint/80" />
        {/*
          "완주"를 키웠다. 숫자만 크면 기록은 읽히는데 **끝냈다는 감정**이
          남지 않는다. 이 화면이 먼저 해야 할 말은 몇 초가 아니라 해냈다는
          것이다.
        */}
        <p className="relative text-2xl font-bold tracking-[0.1em] text-paint">
          {perfect ? "완주" : "도착"}
        </p>
        <p className="relative mt-1 font-mono text-sm text-paint/60">
          {courseName} · {modeLabel}
        </p>
        {/*
          다 맞히지 못한 판에서는 시간이 성적이 아니다.
          열일곱 중 열여섯을 맞힌 사람에게 필요한 말은 "몇 초"가 아니라
          "열여섯 곳"이다. 한 곳을 몰랐다고 해서 그 판에 한 일이 없어지지
          않는다 — 성취를 무효로 만들면 다시 할 이유도 함께 사라진다.
        */}
        {emphasis === "time" && perfect ? (
          <p className="relative mt-4 font-mono text-5xl font-bold tabular-nums text-paint">
            {formatPrecise(shown)}
          </p>
        ) : (
          <p className="relative mt-4 text-5xl font-bold text-paint">
            {score.completed}
            <span className="ml-1 text-2xl font-medium text-paint/70">
              / {score.total}
            </span>
          </p>
        )}
        {/*
          타수를 뺐다. 맞힌 타수가 완주한 지역들의 이름 길이 합으로 고정되므로,
          다 돈 판끼리는 타수가 시간의 다른 표현일 뿐이다. 겨루는 값(완주 수와
          시간)과 손을 재는 값(정확도)만 남긴다.
        */}
        <p className="relative mt-3 font-mono text-sm text-paint/70">
          {perfect
            ? `정확도 ${(score.accuracy * 100).toFixed(1)}%`
            : `${formatPrecise(score.elapsedMs)} · 정확도 ${(score.accuracy * 100).toFixed(1)}%`}
        </p>

        {/*
          기록 해석은 기록에 붙어 있어야 한다. 카드 밖에 한 줄로 떼어 놓았을
          때는 정보량에 비해 자리만 먹고 혼자 떠 있었다.
        */}
        {bestSlot && <div className="relative mt-4">{bestSlot}</div>}

        {!perfect && score.completed > 0 && (
          <p className="relative mt-3 text-base text-paint/70">
            {score.total - score.completed}곳은 다음에 만나요
          </p>
        )}
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
              ? "border border-concrete-deep text-ink hover:bg-concrete-deep"
              : "bg-sign text-paint hover:bg-sign-deep"
          }`}
        >
          {reviewSlot ? "전체 다시 하기" : "한 번 더"}
        </button>

        <Link
          href={coursesHref}
          className="rounded-lg border border-concrete-deep px-5 py-3 text-center font-medium text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          다른 코스
        </Link>

        {/*
          여기부터는 하려는 사람만 본다. 선을 하나 긋고 무게를 낮춘다.
          경쟁이 축인 모드에서는 순서를 뒤집는다 — 타임어택을 한 사람에게
          먼저 필요한 것은 공유가 아니라 순위다.
        */}
        {(shareSlot || submitSlot || nextSlot) && (
          <div className="flex flex-col gap-3 border-t border-concrete-deep pt-5">
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
          상세는 접어 둔다. 다만 열면 무엇이 나오는지 한 줄로 보여 준다 —
          "자세히 보기"만 덩그러니 있으면 아무도 열지 않는다.
        */}
        <details className="group rounded-xl border border-concrete-deep px-5 py-3">
          <summary className="cursor-pointer list-none font-mono text-sm text-dim marker:content-none">
            <span className="flex items-center justify-between gap-4">
              <span className="flex flex-col gap-0.5 text-left">
                자세히 보기
                <span className="text-xs text-dim/80">
                  총 타수 · 오타 · 한 번에 맞힌 곳
                  {score.hintsUsed > 0 && " · 힌트"}
                </span>
              </span>
              <span className="transition-transform group-open:rotate-90">›</span>
            </span>
          </summary>
          <div className="flex flex-col pt-2">
            <Row label="맞힌 타수" value={`${score.correctKeystrokes}타`} />
            <Row label="오타" value={`${score.totalErrors}회`} />
            {/*
              정확도가 손을 재는 숫자라면 정답률은 머리를 잰다. 회상 게임에서
              "몇 곳을 떠올릴 수 있었나"가 진짜 성적이다.
            */}
            <Row
              label="한 번에 맞힌 곳"
              value={`${score.firstTry} / ${score.total} · ${(score.answerRate * 100).toFixed(0)}%`}
            />
            {score.hintsUsed > 0 && (
              <Row label="초성 힌트" value={`${score.hintsUsed}회 · 기록에 가산됨`} />
            )}
          </div>
        </details>
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
}: {
  color: string;
  label: string;
  hatched?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {/*
        색 견본에도 지도와 같은 빗금을 넣는다. 범례와 지도가 다른 그림이면
        범례가 오히려 헷갈리게 한다.
      */}
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{
          backgroundColor: color,
          backgroundImage: hatched
            ? "repeating-linear-gradient(45deg, transparent 0 2px, var(--color-paint) 2px 4px)"
            : undefined,
        }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

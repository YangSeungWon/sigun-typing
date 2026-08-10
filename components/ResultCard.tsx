"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      {/*
        성적 하나만 크게 둔다. 예전에는 타수·첫 기록·기록이 서로 다른 자리에서
        같은 크기로 경쟁해, 무엇이 이 판의 성적인지 읽히지 않았다.
      */}
      {/*
        입체감을 덜어 냈다. 이 서비스의 맛은 화려함이 아니라 관공서스럽고
        건조한데 게임이 되는 데 있는데, 결과 카드만 두꺼운 그림자·이중 테두리·
        그라데이션을 다 쓰면서 혼자 튀었다. 표지판이라는 정체성은 남기고
        두께만 줄인다 — 판면이 주인공인 곳은 플레이 화면이다.
      */}
      <div className="sign-face relative rounded-2xl px-8 py-8 text-center shadow-[0_2px_0_0_var(--color-sign-deep)]">
        <div className="pointer-events-none absolute inset-2.5 rounded-xl border-2 border-paint/80" />
        <p className="relative font-mono text-sm tracking-[0.22em] text-paint/60">
          {perfect ? "완주" : "도착"}
        </p>
        {/*
          다 맞히지 못한 판에서는 시간이 성적이 아니다.
          열일곱 중 열여섯을 맞힌 사람에게 필요한 말은 "몇 초"가 아니라
          "열여섯 곳"이다. 한 곳을 몰랐다고 해서 그 판에 한 일이 없어지지
          않는다 — 성취를 무효로 만들면 다시 할 이유도 함께 사라진다.
        */}
        {emphasis === "time" && perfect ? (
          <p className="relative mt-2 font-mono text-5xl font-bold tabular-nums text-paint">
            {formatPrecise(score.elapsedMs)}
          </p>
        ) : (
          <p className="relative mt-2 text-5xl font-bold text-paint">
            {score.completed}
            <span className="ml-1 text-2xl font-medium text-paint/70">
              / {score.total}
            </span>
          </p>
        )}
        <p className="relative mt-3 font-mono text-sm text-paint/70">
          {perfect
            ? `${Math.round(score.cpm)}타/분 · 정확도 ${(score.accuracy * 100).toFixed(1)}%`
            : `${formatPrecise(score.elapsedMs)} · ${Math.round(score.cpm)}타/분`}
        </p>
        <p className="relative mt-1 text-base text-paint/70">
          {courseName} · {modeLabel}
        </p>
      </div>

      {/*
        다 맞히지 못했다면 그 사실을 한 줄로만 말한다. 몇 곳을 못 맞혔는지는
        아래 "다시 볼 곳"에 이름으로 있고, 여기서 또 나무랄 이유가 없다.
      */}
      {!perfect && score.completed > 0 && (
        <p className="text-center text-base text-dim">
          {score.total - score.completed}곳은 다음에 만나요
        </p>
      )}

      {/* 전보다 나아졌는가. 성적 바로 아래에 붙어야 견줄 수 있다. */}
      {bestSlot}

      {/*
        판이 끝난 직후 가장 센 충동은 "한 번 더"다. 다만 못 맞힌 곳이 있으면
        그쪽이 먼저다 — 열일곱 중 셋을 몰랐는데 열일곱을 다시 도는 것보다
        그 셋을 보는 편이 배우는 데도 빠르고 부담도 적다.
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

      {missed.length > 0 && (
        /*
          지도만으로는 회색이 어디인지 이름으로 읽히지 않는다. 모르겠다고
          넘긴 사람이 정말 알고 싶은 것은 "그래서 거기가 어디였나"이고,
          그 답이 결과 화면에 없으면 판이 끝나도 배운 게 없다.
        */
        <section className="flex flex-col gap-3 rounded-xl border border-concrete-deep bg-paint/60 p-5">
          <h2 className="font-mono text-sm tracking-[0.18em] text-dim uppercase">
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

      {/*
        지도는 플레이 중에는 주인공이지만 결과 화면에서는 기록이 주인공이다.
        예전 크기(h-80)로는 지도가 화면을 다 차지해 그 아래 숫자가 밀렸다.
      */}
      {geo && (
        <div className="flex flex-col items-center gap-2">
          <RegionMap
            geo={geo}
            passedCodes={passedCodes}
            missedCodes={missed.filter((r) => r.skipped).map((r) => r.id)}
            variant="route"
            className="h-40 w-auto sm:h-52"
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
        상세는 접어 둔다. 결과 화면에서 사람이 알고 싶은 것은 셋이다 —
        잘했나, 전보다 나아졌나, 다음엔 뭘 하나. 타수와 오타 수는 그 셋에
        답하지 않으면서 화면의 절반을 차지하고 있었다.
      */}
      <details className="group rounded-xl border border-concrete-deep px-5 py-3">
        <summary className="cursor-pointer list-none font-mono text-sm text-dim marker:content-none">
          <span className="flex items-center justify-between gap-4">
            자세히 보기
            <span className="transition-transform group-open:rotate-90">›</span>
          </span>
        </summary>
        <div className="flex flex-col pt-2">
          <Row label="총 타수" value={`${score.correctKeystrokes}타`} />
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

      <Link
        href={coursesHref}
        className="rounded-lg border border-concrete-deep px-5 py-3 text-center font-medium text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        다른 코스
      </Link>

      {/*
        자랑과 등록은 여기까지 내려온다.

        판을 끝낸 사람의 다음 행동은 대개 "한 번 더"이고, 남에게 보이는 일은
        그 다음이다. 다섯 개의 버튼을 같은 크기로 늘어놓으면 다 끝낸 순간에
        메뉴를 다시 읽게 된다. 선을 하나 긋고 아래로 내리면, 하려는 사람은
        그대로 하고 안 할 사람은 눈을 주지 않아도 된다.

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
              {shareSlot}
              {submitSlot}
            </>
          )}
          {nextSlot}
        </div>
      )}
    </div>
  );
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

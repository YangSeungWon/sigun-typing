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
        {emphasis === "time" ? (
          <p className="relative mt-2 font-mono text-5xl font-bold tabular-nums text-paint">
            {formatPrecise(score.elapsedMs)}
          </p>
        ) : (
          <p className="relative mt-2 text-5xl font-bold text-paint">
            {score.completed}
            <span className="ml-1 text-2xl font-medium text-paint/70">곳</span>
          </p>
        )}
        <p className="relative mt-3 font-mono text-sm text-paint/70">
          {Math.round(score.cpm)}타/분 · 정확도 {(score.accuracy * 100).toFixed(1)}% ·{" "}
          {score.completed}/{score.total}
        </p>
        <p className="relative mt-1 text-base text-paint/70">
          {courseName} · {modeLabel}
        </p>
      </div>

      {/* 판이 끝난 직후 가장 센 충동. 여기 말고 다른 자리에 둘 이유가 없다. */}
      <button
        type="button"
        onClick={onRestart}
        className="rounded-lg bg-sign px-5 py-4 text-lg font-medium text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        한 번 더
        {emphasis === "time" && score.completed > 0 && (
          <span className="ml-2 font-mono text-base text-paint/80">
            {formatPrecise(score.elapsedMs)} 깨기
          </span>
        )}
      </button>

      {bestSlot}
      {shareSlot}
      {submitSlot}

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
                {!r.skipped && <span className="ml-1.5 text-sm text-dim">오타</span>}
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
          <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-sm text-dim">
            {/* 색만으로 설명하면 색을 구분하기 어려운 사람에게는 아무 말도 아니다. */}
            <Legend color="var(--color-sign)" label={`맞힘 ${score.completed}`} />
            {missed.some((r) => r.skipped) && (
              <Legend
                color="var(--color-alert)"
                label={`못 맞힘 ${missed.filter((r) => r.skipped).length}`}
              />
            )}
          </span>
        </div>
      )}

      <div className="flex flex-col">
        <Row label="총 타수" value={`${score.correctKeystrokes}타`} />
        <Row label="오타" value={`${score.totalErrors}회`} />
        {score.hintsUsed > 0 && (
          <Row label="초성 힌트" value={`${score.hintsUsed}회 · 기록에 가산됨`} />
        )}
      </div>

      {nextSlot}

      <Link
        href={coursesHref}
        className="rounded-lg border border-concrete-deep px-5 py-3 text-center font-medium text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        다른 코스
      </Link>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

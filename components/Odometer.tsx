"use client";

interface OdometerProps {
  cpm: number;
  accuracy: number;
  elapsedMs: number;
  /** 제한 시간이 있는 모드에서 남은 시간. 무제한이면 Infinity. */
  remainingMs: number;
  /** 시간만 보여 준다. 플레이 중에는 이쪽이 기본이다. */
  compact?: boolean;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Readout({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        /*
         * 플레이 중 판단에 쓰는 것은 지도와 입력판이지 이 숫자가 아니다.
         * 셋이 다 크면 매 타건마다 바뀌는 숫자가 시선을 끌어간다.
         */
        className={`font-mono tabular-nums ${
          emphasis ? "text-2xl font-semibold text-ink sm:text-3xl" : "text-xl text-dim sm:text-2xl"
        }`}
      >
        {value}
      </span>
      <span className="font-mono text-[0.7rem] tracking-[0.16em] text-dim uppercase">
        {label}
      </span>
    </div>
  );
}

/** 계기판. 주행 중 읽는 숫자이므로 전부 모노스페이스 고정폭이다. */
export function Odometer({
  cpm,
  accuracy,
  elapsedMs,
  remainingMs,
  compact = false,
}: OdometerProps) {
  const timed = Number.isFinite(remainingMs);
  const low = timed && remainingMs <= 10_000;

  return (
    <div className="flex w-full items-start justify-center gap-8 border-t border-concrete-deep pt-4 sm:gap-12">
      {!compact && (
        <>
          <Readout label="타/분" value={String(Math.round(cpm))} emphasis />
          <Readout label="정확도" value={`${(accuracy * 100).toFixed(1)}%`} />
        </>
      )}
      {timed ? (
        <div className={low ? "animate-pulse" : undefined}>
          <Readout label="남은 시간" value={formatClock(remainingMs)} />
        </div>
      ) : (
        <Readout label="경과" value={formatClock(elapsedMs)} />
      )}
    </div>
  );
}

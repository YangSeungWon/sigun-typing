"use client";

import type { RoomPlayer } from "@/lib/multiplayer/types";

interface StandingsProps {
  players: RoomPlayer[];
  total: number;
  selfId: string | null;
  hostId: string | null;
  /** 대기실에서는 진행도 대신 준비 여부를 보여준다 */
  showReady?: boolean;
}

/**
 * 참가자 목록 겸 순위표. 경주 중에는 각자가 코스의 어디쯤 있는지를
 * 도로 위 진행 막대로 보여준다 — 숫자보다 이게 먼저 읽힌다.
 */
export function Standings({
  players,
  total,
  selfId,
  hostId,
  showReady = false,
}: StandingsProps) {
  return (
    <ul className="flex w-full flex-col gap-2">
      {players.map((p) => {
        const isSelf = p.id === selfId;
        const pct = total > 0 ? Math.round((p.index / total) * 100) : 0;

        return (
          <li
            key={p.id}
            className={`rounded-lg border px-4 py-3 ${
              isSelf ? "border-sign bg-paint/70" : "border-concrete-deep bg-paint/40"
            } ${p.connected ? "" : "opacity-45"}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-baseline gap-2">
                {p.rank !== null && (
                  <span className="font-mono text-base font-semibold text-sign">
                    {p.rank}위
                  </span>
                )}
                <span className="font-medium">{p.nickname}</span>
                {p.id === hostId && (
                  <span className="font-mono text-xs tracking-[0.12em] text-dim uppercase">
                    방장
                  </span>
                )}
                {isSelf && (
                  <span className="font-mono text-xs tracking-[0.12em] text-dim uppercase">
                    나
                  </span>
                )}
                {!p.connected && (
                  <span className="font-mono text-sm text-dim">나감</span>
                )}
              </span>

              {showReady ? (
                <span
                  className={`font-mono text-sm ${p.ready ? "text-sign" : "text-dim"}`}
                >
                  {p.ready ? "준비됨" : "대기 중"}
                </span>
              ) : (
                <span className="font-mono text-base tabular-nums text-dim">
                  <span>{p.index}/{total}</span>
                  <span className="ml-3">{Math.round(p.cpm)}타</span>
                </span>
              )}
            </div>

            {!showReady && (
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-concrete-deep"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${p.nickname} 진행도`}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    p.rank !== null ? "bg-centerline" : "bg-sign"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

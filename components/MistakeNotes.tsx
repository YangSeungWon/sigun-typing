"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { COURSES } from "@/data/courses";
import { useIsHydrated } from "@/lib/useIsHydrated";
import {
  clearMistakes,
  loadAllMistakes,
  type MistakeRecord,
} from "@/lib/score/mistakes";

/** 한 번에 보여줄 지역 수. 그 이상은 목록이 아니라 벽이 된다. */
const VISIBLE = 12;

interface Entry {
  courseId: string;
  courseName: string;
  records: MistakeRecord[];
}

/**
 * 헷갈리는 지역.
 *
 * 오답은 기기에만 남으므로 서버가 그릴 수 없다. 첫 렌더에서 한 번 읽고,
 * 지운 뒤에만 다시 읽는다.
 */
export function MistakeNotes() {
  const read = useCallback((): Entry[] => {
    const names = new Map(COURSES.map((c) => [c.id, c.name]));
    return loadAllMistakes(COURSES.map((c) => c.id)).map((entry) => ({
      ...entry,
      courseName: names.get(entry.courseId) ?? entry.courseId,
    }));
  }, []);

  // 서버에는 localStorage가 없다. 하이드레이션 전에는 서버와 같은 것을 그린다.
  const hydrated = useIsHydrated();
  const [cleared, setCleared] = useState<string[]>([]);
  const entries = useMemo(
    () => (hydrated ? read().filter((e) => !cleared.includes(e.courseId)) : []),
    [hydrated, cleared, read],
  );

  const forget = (courseId: string) => {
    clearMistakes(courseId);
    setCleared((prev) => [...prev, courseId]);
  };

  if (!hydrated) {
    return <div className="h-32" aria-hidden="true" />;
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-concrete-deep bg-paint/60 p-8">
        <p className="text-dim">
아직 헷갈리는 곳이 없습니다. 틀리거나 힌트를 본 지역이 여기 모입니다.
        </p>
        {/* 약속한 것이 "지도 고르기"이므로 목록으로 보낸다. 첫 화면에는 이제 없다. */}
        <Link
          href="/courses"
          className="rounded-lg bg-sign px-5 py-3 font-medium text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          코스 고르기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {entries.map((entry) => (
        <section key={entry.courseId} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-xl font-semibold">{entry.courseName}</h2>
            <span className="font-mono text-sm tabular-nums text-dim">
              {entry.records.length}곳
            </span>
          </div>

          <ul className="flex flex-wrap gap-2">
            {entry.records.slice(0, VISIBLE).map((r) => (
              <li
                key={r.code}
                className="flex items-baseline gap-2 rounded-lg border border-concrete-deep bg-paint/60 px-3 py-2"
              >
                <span className="text-lg font-medium">{r.name}</span>
                {/*
                  틀린 횟수는 시스템이 세는 값이고, 사용자가 알고 싶은 것은
                  자기 상태다. 한 번 맞히면 남은 건 한 번뿐이라는 사실을
                  규칙으로 설명하는 대신 "거의 외웠다"로 옮긴다.
                */}
                <span
                  className={`font-mono text-sm ${
                    r.cleanStreak > 0 ? "text-sign" : "text-dim"
                  }`}
                >
                  {r.cleanStreak > 0 ? "거의 외움" : `${r.misses}번 헷갈림`}
                </span>
              </li>
            ))}
            {entry.records.length > VISIBLE && (
              <li className="flex items-center px-3 py-2 font-mono text-sm text-dim">
                외 {entry.records.length - VISIBLE}곳
              </li>
            )}
          </ul>

          <div className="flex gap-3">
            <Link
              href={`/review/${entry.courseId}`}
              className="rounded-lg bg-sign px-5 py-3 font-medium text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              헷갈리는 곳만 연습
            </Link>
            <button
              type="button"
              onClick={() => forget(entry.courseId)}
              className="rounded-lg border border-concrete-deep px-5 py-3 font-medium text-dim transition-colors hover:bg-concrete-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              기록 지우기
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

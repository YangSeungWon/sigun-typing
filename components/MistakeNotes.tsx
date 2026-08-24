"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { COURSES } from "@/data/courses";
import { atlasLearnUrl } from "@/lib/atlas";
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
  /** 같은 곳을 지도에서 익힐 수 있는 옆 사이트 주소. 대응이 없으면 null이다. */
  atlas: string | null;
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
    // 읍면동 코스는 시군구 코드로 저쪽 동 지도에 바로 닿는다.
    const prefixes = new Map(COURSES.map((c) => [c.id, c.geo?.prefix]));
    return loadAllMistakes(COURSES.map((c) => c.id)).map((entry) => ({
      ...entry,
      courseName: names.get(entry.courseId) ?? entry.courseId,
      atlas: atlasLearnUrl(entry.courseId, "notes", prefixes.get(entry.courseId)),
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
      <div className="flex flex-col items-start gap-4 rounded-xl border border-edge bg-paint p-8">
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
                className="flex items-baseline gap-2 rounded-lg border border-edge bg-paint px-3 py-2"
              >
                <span className="text-lg font-medium">{r.name}</span>
                {/*
                  틀린 횟수는 시스템이 세는 값이고, 사용자가 알고 싶은 것은
                  자기 상태다. 한 번 맞히면 남은 건 한 번뿐이라는 사실을
                  규칙으로 설명하는 대신 "거의 외웠다"로 옮긴다.
                */}
                <span
                  className={`font-mono text-sm ${
                    r.cleanStreak > 0 ? "text-sign-deep" : "text-dim"
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
              className="rounded-lg border border-edge px-5 py-3 font-medium text-dim transition-colors hover:bg-concrete-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              기록 지우기
            </button>
          </div>

          {/*
            같은 지도를 반대로 묻는 곳으로 가는 문.

            여기까지 온 사람은 이름이 아예 안 떠오르는 것이고, 그건 더 친다고
            나아지는 종류가 아니다. 지도를 눈으로 훑는 편이 빠르다 — 그게
            저쪽이 하는 일이고 여기에는 없다.

            자리는 여기뿐이다. 푸터나 첫 화면에 박으면 링크 교환으로 읽히고,
            정작 막힌 사람에게는 안 닿는다. 이 줄 바로 위에 그 사람이 자꾸
            틀리는 곳들이 이름째로 떠 있다.
          */}
          {entry.atlas && (
            <a
              href={entry.atlas}
              target="_blank"
              rel="noopener"
              className="self-start text-sm text-dim underline decoration-edge underline-offset-4 transition-colors hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {entry.courseName} 지도에서 위치부터 익히기
            </a>
          )}
        </section>
      ))}
    </div>
  );
}

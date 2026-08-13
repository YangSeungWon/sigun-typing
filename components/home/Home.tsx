"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { formatClock } from "@/components/Odometer";
import { NationalMap } from "./NationalMap";
import { useHomeData } from "@/lib/home/useHomeData";
import type { HomeSeed } from "@/lib/home/summary";

/**
 * 첫 화면.
 *
 * 오래 코스 목록이었다. 그 판단에는 근거가 있었고(이 서비스는 지도를 고르고 노는
 * 곳이지 오늘 뭘 할지 추천해 주는 곳이 아니다) 지금도 절반은 맞다 — 다만 그
 * 설명이 필요한 사람은 **처음 온 사람뿐**이었다. 두 번째부터는 "어떤 지도가
 * 있나"가 아니라 "어디까지 했더라"가 먼저다.
 *
 * 그래서 목록은 `/courses`로 내리고 여기는 상태판이 된다.
 * 정복도 → 이어하기 → 오늘의 도전 → 오답, 네 가지만 답한다.
 *
 * 없는 값은 **자리째 없다.** 아직 아무것도 안 한 사람에게 `0 / 245`와 빈 막대
 * 다섯 줄을 보여 주는 것은 정보가 아니라, 시작하기도 전에 뒤처졌다는 말이다.
 * 그래서 처음 온 사람의 화면에는 히어로와 오늘의 도전과 대결 줄만 남는다.
 *
 * 넓은 화면과 좁은 화면이 같은 DOM을 쓴다. 배치만 `.home-grid`가 바꾼다 —
 * 화면마다 컴포넌트를 따로 만들면 숫자를 세는 코드가 두 벌이 된다.
 */
export function Home({ seed, geo }: { seed: HomeSeed; geo: CourseGeo | null }) {
  const data = useHomeData(seed);
  const router = useRouter();

  const progress = useMemo(
    () => new Map(data.sidoProgress.map((s) => [s.code, s])),
    [data.sidoProgress],
  );

  const remaining = data.resume.total - (data.resume.known ?? 0);
  const hasConfusion = data.confusion !== null;
  const hasConquest = data.sidoProgress.length > 0;

  return (
    <main
      className="home-grid mx-auto w-full max-w-5xl flex-1 px-5 py-6 md:px-6 md:py-10"
      data-confuse={hasConfusion ? "on" : "off"}
      data-conquest={hasConquest ? "on" : "off"}
    >
      {/*
        넓은 화면에서 copy와 actions는 지도 옆의 두 행이라 각자 반 칸씩 갖는다.
        둘 다 가운데 정렬하면 사이가 크게 벌어지므로 서로를 향해 붙인다.
      */}
      <section className="home-copy flex flex-col justify-center gap-3 md:justify-end">
        {/*
          숫자가 문장을 대신한다. 처음 온 사람에게도 그렇다.

          한때 여기 카피가 있었고(`지도는 아는데, 이름도 맞힐 수 있나요?`)
          기록이 생기면 숫자로 갈아 끼웠다. 그러느라 첫 방문과 재방문의 첫
          화면이 서로 다른 물건이 됐다 — 한쪽은 문장이 맞아 주고 다른 쪽은
          계기판이 맞아 준다. 245라는 분모는 카피가 하려던 말("대한민국 전체가
          걸려 있다")을 더 짧게 한다.

          이것이 이 화면의 h1이다. 이 화면의 제목은 서비스 이름이 아니라 지금
          어디까지 왔는가다. 화면을 눈으로 훑을 수 없는 사람에게도 그게 첫
          줄이어야 하므로 숫자를 말로 옮겨 붙인다 — `63 / 245`를 그대로 읽으면
          분수처럼 들린다.
        */}
        <h1
          className="font-mono text-5xl font-bold tabular-nums sm:text-6xl"
          aria-label={`${data.conquest.total}곳 중 ${data.conquest.known}곳, 정복도 ${data.conquest.percent}퍼센트`}
        >
          <span aria-hidden>
            {data.conquest.known}
            <span className="text-dim"> / {data.conquest.total}</span>
          </span>
        </h1>
        <p className="font-mono text-lg text-sign" aria-hidden>
          정복도 {data.conquest.percent}%
        </p>

        {/*
          규칙 한 줄. 아직 한 곳도 모르는 사람에게만 나온다.

          이건 카피가 아니라 안내다. 첫 화면에서 목록을 걷어낸 뒤로 처음 온
          사람이 보는 것은 지도 한 장과 버튼 두 개뿐인데, 그것만으로는 이
          게임이 무엇을 시키는지 알 수 없다 — 예전에는 코스 목록이 그 설명을
          대신하고 있었다.

          한 판이라도 하면 사라진다. 익숙해질수록 화면이 조용해져야 한다.
        */}
        {data.conquest.known === 0 && (
          <p className="text-base text-dim break-keep">
            지도에 표시된 곳의 이름을 입력합니다.
          </p>
        )}
      </section>

      <div className="home-map-slot flex items-center justify-center">
        {geo && (
          <div className="w-full max-w-sm md:max-w-md">
            <NationalMap geo={geo} progress={progress} />
          </div>
        )}
      </div>

      <section className="home-actions flex flex-col justify-center gap-3 md:justify-start">
        {/*
          높이를 잡아 둔다. 이 줄의 값은 하이드레이션 뒤에 정해지는데, 그때
          없던 줄이 생기면 아래 카드들이 통째로 밀린다.

          `28 / 31`이 아니라 `3곳 남음`이다. 코스 이름에 이미 총 개수가 들어
          있어서(`경기도 31 시군`) 분모를 또 적으면 한 줄에 31이 두 번 나온다.
          그리고 이어하기 버튼 옆에서 궁금한 것은 얼마나 왔나가 아니라 얼마나
          남았나다.
        */}
        <p className="flex h-6 items-center font-mono text-sm text-dim">
          {data.resume.kind === "resume" && remaining > 0 && (
            <span>
              {data.resume.courseName} · {remaining}곳 남음
            </span>
          )}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={`/play/map/${data.resume.courseId}?from=home_hero`}
            className="rounded-xl bg-sign px-6 py-4 text-center text-xl font-bold text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-10"
          >
            {data.resume.kind === "start" ? "시작" : "이어하기"}
          </Link>

          {/*
            링크가 아니라 버튼이다. 어디로 갈지는 **누를 때** 정해야 한다 —
            렌더 중에 뽑으면 서버와 브라우저가 다른 코스를 고르고, 그게 곧
            하이드레이션 불일치다.
          */}
          <button
            type="button"
            onClick={() => {
              const pick = seed.courses[Math.floor(Math.random() * seed.courses.length)];
              router.push(`/play/map/${pick.id}?from=home_secondary`);
            }}
            className="rounded-xl border border-concrete-deep px-6 py-4 text-center text-base font-medium transition-colors hover:border-dim hover:bg-paint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            랜덤 도전
          </button>
        </div>
      </section>

      <section className="home-today flex flex-col gap-3 rounded-xl border border-concrete-deep bg-paint/60 p-5">
        <h2 className="font-mono text-sm text-dim">오늘의 도전</h2>
        <p className="text-2xl font-semibold">{data.today.courseName}</p>
        <p className="font-mono text-sm text-dim tabular-nums">
          {data.today.total}곳
          {data.today.bestMs !== undefined && ` · 최고 ${formatClock(data.today.bestMs)}`}
        </p>
        {/*
          카드가 줄을 통째로 쓸 때가 있다(헷갈리는 곳과 정복도가 아직 없는
          첫 방문). 그때 버튼까지 늘어나면 화면을 가로지르는 초록 띠가 된다.
          좁은 화면에서는 카드 자체가 한 칸이므로 채우는 것이 맞다.
        */}
        <Link
          href={`/play/map/${data.today.courseId}?from=home_challenge`}
          className="mt-auto rounded-lg bg-sign px-5 py-3 text-center font-medium text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:self-start md:px-10"
        >
          시작
        </Link>
      </section>

      {/*
        헷갈리는 짝.

        `최근 5번 중 3번 혼동`이라고 쓸 수 없다. 분모를 저장하지 않기 때문이고,
        그럴듯하게 지어내느니 아는 것만 적는다.
      */}
      {data.confusion && (
        <section className="home-confuse flex flex-col gap-3 rounded-xl border border-concrete-deep bg-paint/60 p-5">
          <h2 className="font-mono text-sm text-dim">자꾸 헷갈리는 곳</h2>
          <p className="text-2xl font-semibold">
            {data.confusion.a} <span className="text-dim">↔</span> {data.confusion.b}
          </p>
          <p className="font-mono text-sm text-alert tabular-nums">
            최근 오답 {data.confusion.count}회
          </p>
          <Link
            href={`/review/${data.confusion.courseId}`}
            className="mt-auto rounded-lg border border-concrete-deep px-5 py-3 text-center font-medium transition-colors hover:border-dim hover:bg-paint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            오답 복습
          </Link>
        </section>
      )}

      {hasConquest && (
        <section className="home-conquest flex flex-col gap-3 rounded-xl border border-concrete-deep bg-paint/60 p-5">
          <h2 className="font-mono text-sm text-dim">대한민국 정복도</h2>
          <ul className="flex flex-col gap-2">
            {/*
              좁은 화면에서는 셋까지. 열일곱 줄을 다 세우면 첫 화면이 이
              표 하나로 끝나고, 이 블록은 요약이지 목록이 아니다.
            */}
            {data.sidoProgress.slice(0, 5).map((s, i) => (
              <li
                key={s.code}
                className={`flex items-center gap-3 ${i >= 3 ? "hidden md:flex" : ""}`}
              >
                <span className="w-10 shrink-0 text-sm">{s.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-concrete-deep">
                  <span
                    className="block h-full rounded-full bg-sign"
                    style={{ width: `${s.percent}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs text-dim tabular-nums">
                  {s.known} / {s.total}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/courses"
            className="mt-auto font-mono text-sm text-dim transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            전체 보기 →
          </Link>
        </section>
      )}

      {/*
        대결은 한 줄로 둔다. 혼자 하는 흐름이 이 서비스의 본체라, 카드로 키우면
        그 흐름을 가로막는다.
      */}
      <section className="home-friends flex items-center justify-between gap-4 rounded-xl border border-concrete-deep px-5 py-4">
        <span className="font-medium">친구 대결</span>
        <Link
          href="/rooms"
          className="rounded-lg border border-concrete-deep px-5 py-2 font-medium transition-colors hover:border-dim hover:bg-paint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          대결
        </Link>
      </section>
    </main>
  );
}

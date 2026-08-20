"use client";

import Link from "next/link";
import { DailyLine } from "./DailyLine";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CourseGeo } from "@/data/geo/types";
import { NationalMap } from "./NationalMap";
import { SidoPicker } from "./SidoPicker";
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
 *
 * 남긴 것은 넷이다 — 얼마나 왔나(숫자), 어디가 비었나(지도), 무엇을 이어할까
 * (버튼), 무엇을 자꾸 틀리나(오답). `오늘의 도전`과 `대한민국 정복도` 카드가
 * 있었는데 지웠다. 지도 옆에 목록을 붙이면서 정복도 카드가 그 목록의 열등한
 * 사본이 됐고(같은 숫자를 열여섯 개 대신 다섯 개만), 오늘의 도전은 히어로와
 * 지도와 목록에 이어 **네 번째로 코스를 고르는 자리**였다.
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

  /**
   * 지도에서 고른 시도. 아무것도 안 고르면 null이고, 그때는 이어하기가 뜬다.
   *
   * 지도가 색만 칠해진 그림이던 동안에는 비어 있는 곳이 눈에 띄어도 거기서 할
   * 수 있는 일이 없었다 — 목록으로 가서 이름으로 다시 찾아야 했다. 눈에 띈
   * 자리에서 바로 시작할 수 있어야 지도가 첫 화면의 절반을 차지할 값을 한다.
   */
  const [picked, setPicked] = useState<string | null>(null);

  /**
   * 지금 손이 얹힌 시도. 지도와 목록이 함께 본다.
   *
   * 둘은 같은 선택을 가리키는 두 창인데 손 얹힘까지 각자 알면, 목록에서
   * `전북`을 짚어도 지도는 아무 말이 없다. 이름은 아는데 어디인지 모르는
   * 사람에게 그 순간이 이 게임이 가르칠 수 있는 자리다.
   */
  const [hovered, setHovered] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(seed.courses.map((c) => [c.id, c])),
    [seed.courses],
  );

  /** 지도 한 조각이 알아야 하는 것들. 진행도는 해 본 시도에만 있다. */
  const mapRegions = useMemo(() => {
    const known = new Map(data.sidoProgress.map((s) => [s.code, s]));
    return new Map(
      seed.sido.map((s) => {
        const course = s.courseId ? byId.get(s.courseId) : undefined;
        const hit = known.get(s.code);
        return [
          s.code,
          {
            code: s.code,
            name: s.name,
            courseId: s.courseId,
            courseName: course?.name,
            known: hit?.known ?? 0,
            total: s.total,
            percent: hit?.percent ?? 0,
          },
        ];
      }),
    );
  }, [seed.sido, byId, data.sidoProgress]);

  /**
   * 지금 버튼이 가리키는 코스.
   *
   * 고른 것이 있으면 그것이 이긴다 — 방금 지도를 누른 사람의 뜻이 지난번에
   * 하던 코스보다 최근이다.
   */
  const pickedRegion = picked ? mapRegions.get(picked) : undefined;
  const pickedCourse = pickedRegion?.courseId
    ? byId.get(pickedRegion.courseId)
    : undefined;

  const target = pickedCourse
    ? {
        courseId: pickedCourse.id,
        shortName: pickedCourse.shortName,
        known: pickedRegion!.known,
        total: pickedCourse.total,
      }
    : {
        courseId: data.resume.courseId,
        shortName: byId.get(data.resume.courseId)?.shortName ?? "",
        known: data.resume.known ?? 0,
        total: data.resume.total,
      };

  /** 처음 여는 코스면 `시작`, 하다 만 코스면 `이어하기`. */
  const verb =
    target.known > 0 && target.known < target.total ? "이어하기" : "시작";

  /*
   * 계기판에 무엇을 올릴 것인가.
   *
   * 지도에서 고른 것이 있으면 그게 올라간다. 방금 누른 결과가 화면에서 가장
   * 작은 글씨로 뜨는 것은 앞뒤가 맞지 않는다 — 누른 곳의 상태를 보려고 누른
   * 것이므로, 그 답이 제일 크게 나와야 한다.
   *
   * 없앤 쪽을 버리지는 않는다. 둘의 자리가 바뀔 뿐이라 화면에는 늘 두 숫자가
   * 함께 있고, 각자 라벨을 달고 있어서 무엇의 분모인지 헷갈리지 않는다.
   *
   * `대한민국`이라고 부르는 이유: 전국 코스(`전국 17 시도`)의 짧은 이름이
   * `전국`이라, 245 쪽도 `전국`이면 그 코스를 골랐을 때 같은 라벨이 다른
   * 분모를 달고 위아래로 붙는다. 아래 정복도 카드가 이미 `대한민국`을 쓴다.
   */
  const nationwide = {
    label: "대한민국",
    known: data.conquest.known,
    total: data.conquest.total,
  };
  const scoped = {
    label: target.shortName,
    known: target.known,
    total: target.total,
  };
  /** 목록에 세우는 것들. 고를 수 없는 세종은 빠진다 — 눌러도 갈 데가 없다. */
  const pickableRegions = useMemo(
    () => [...mapRegions.values()].filter((r) => r.courseId),
    [mapRegions],
  );

  const primary = pickedCourse ? scoped : nationwide;
  const secondary = pickedCourse ? nationwide : scoped;

  const hasConfusion = data.confusion !== null;

  return (
    <main
      id="main"
      tabIndex={-1}
      className="home-grid mx-auto w-full max-w-5xl flex-1 px-5 py-5 md:px-6 md:py-8"
      data-confuse={hasConfusion ? "on" : "off"}
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
        {/*
          퍼센트를 뺐다.

          `9 / 245`와 `정복도 4%`는 같은 것을 두 번 말한다. 게다가 245분의 1은
          0.4%라 반올림하면 `0%`가 되는데, 한 곳을 맞힌 사람에게 0을 보여 주는
          것은 사실도 아니고 기분도 나쁘다. 분수 쪽이 더 정확하고 더 빨리
          읽힌다. 퍼센트가 필요한 자리는 아래 정복도 카드다.

          `전국`은 남긴다. 바로 아래 줄이 코스 하나의 진행(`9 / 16 부산`)이라
          두 숫자가 세로로 붙는데, 위가 무엇의 분모인지 말해 주지 않으면
          `9 / 245`가 부산에서 9곳 맞혔다는 뜻으로도 읽힌다. 줄을 따로 쓰지
          않고 숫자 뒤에 붙여 한 줄을 아낀다.
        */}
        {/*
          라벨은 숫자 옆이 아니라 위에 둔다.

          옆에 붙였더니 `0 / 245 대한민국`이 좁은 칸(넓은 화면에서 세 칸 중
          하나)을 넘겨 큰 숫자가 줄바꿈됐다. 라벨 길이는 고른 곳에 따라 두
          글자에서 네 글자까지 오가므로, 옆자리는 애초에 폭을 장담할 수 없는
          자리다. 위는 몇 글자가 오든 흔들리지 않는다.
        */}
        <h1
          aria-label={`${primary.label} ${primary.total}곳 중 ${primary.known}곳`}
        >
          <span aria-hidden className="block font-mono text-sm text-dim">
            {primary.label}
          </span>
          <span
            aria-hidden
            className="block font-mono text-5xl font-bold tabular-nums sm:text-6xl"
          >
            {primary.known}
            <span className="text-dim"> / {primary.total}</span>
          </span>
        </h1>

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

      {/*
        지도 크기.

        한때 좁은 화면에서는 줄이지 못했다. 줄이면 광주·대전·울산처럼 작은
        시도를 손가락으로 누를 수 없게 되기 때문이었다. 옆에 목록이 생기면서
        그 제약이 풀렸다 — 작은 곳은 이름으로 고르면 되므로 지도가 정밀한
        과녁일 필요가 없다. 여기서 지도가 하는 일은 다시 "어디가 비었나"
        하나로 돌아간다.

        그만큼 세로를 돌려받아 첫 화면 아래에 다음 카드가 보인다.
      */}
      <div className="home-map-slot flex flex-col items-center justify-center gap-3 lg:flex-row lg:items-center lg:gap-5">
        {/*
            좁은 화면에서는 **폭이 아니라 화면 높이**로 잡는다.
            (지도 자체가 `w-full`이라 높이를 직접 물리면 폭만 남아 편지지가
            된다. 폭 상한으로 거는 편이 확실하다 — 이 지도는 세로가 조금 길어
            높이가 폭의 1.06배쯤이다.)

            폭으로만 잡으면 짧은 폰에서 잘렸다. 아이폰 SE는 세로가 667px인데
            사파리 툴바를 빼면 550px대만 보이고, 그 안에 제목·지도·시도 칩 세
            줄이 다 들어간 뒤에야 `전국 시작`이 온다. 처음 온 사람이 이 게임을
            시작하는 유일한 문이 첫 화면에서 안 보이는 것이다.

            `svh`를 쓴다. `vh`는 iOS에서 툴바가 없는 상태를 기준으로 잡아
            정작 툴바가 있을 때 더 커진다 — 고치려는 문제를 그대로 남긴다.

            줄여도 되는 이유는 아래 주석과 같다. 작은 시도는 이름으로 고르므로
            지도가 정밀한 과녁일 필요가 없다.
        */}
        {geo && (
          <div className="w-full max-w-[min(17rem,21svh)] sm:max-w-sm lg:min-w-0 lg:flex-1">
            <NationalMap
              geo={geo}
              regions={mapRegions}
              selectedCode={picked}
              onSelect={setPicked}
              hoveredCode={hovered}
              onHover={setHovered}
            />
          </div>
        )}
        {/*
          지도로는 고를 수 없는 곳이 있다(대전·광주·울산은 몇 픽셀이다).
          같은 선택을 이름으로도 고를 수 있게 둔다.
        */}
        <SidoPicker
          regions={pickableRegions}
          selectedCode={picked}
          onSelect={setPicked}
          hoveredCode={hovered}
          onHover={setHovered}
        />
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
        {/*
          큰 줄과 **같은 모양**으로 적는다 — 숫자 먼저, 라벨 뒤.
          둘이 자리를 바꿔 가며 뜨는 값이라 모양까지 같아야 바뀐 것이 값이지
          종류가 아니라는 게 읽힌다.

          가운데점을 뺐다. `부산 · 9 / 16`은 점 하나가 이름과 숫자 사이에
          끼어들어 눈이 한 번 멈추는데, 여백이 같은 일을 소리 없이 한다.
        */}
        <p className="flex h-6 items-baseline gap-2 font-mono text-sm text-dim tabular-nums">
          {secondary.label && (
            <>
              <span>
                {secondary.known} / {secondary.total}
              </span>
              <span>{secondary.label}</span>
            </>
          )}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/*
            버튼이 어디로 가는지 스스로 말한다. `이어하기`만 적혀 있으면 지도에서
            방금 고른 곳으로 가는지 지난번 코스로 가는지 눌러 봐야 안다.
          */}
          <Link
            href={`/play/map/${target.courseId}?from=home_hero`}
            className="rounded-xl bg-sign px-6 py-4 text-center text-xl font-bold text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-10"
          >
            {target.shortName} {verb}
          </Link>

          {/*
            링크가 아니라 버튼이다. 어디로 갈지는 **누를 때** 정해야 한다 —
            렌더 중에 뽑으면 서버와 브라우저가 다른 코스를 고르고, 그게 곧
            하이드레이션 불일치다.
          */}
          <button
            type="button"
            onClick={() => {
              /*
               * 겹치는 코스는 뽑지 않는다. `랜덤`을 누르는 사람은 가볍게 한 판
               * 하겠다는 뜻인데 스무 판쯤 걸리는 전국 시군구가 나오면 약속이
               * 다르다. 끝판왕은 찾아가는 것이지 걸리는 것이 아니다.
               */
              const pool = seed.courses.filter((c) => !c.overlapping);
              const pick = pool[Math.floor(Math.random() * pool.length)];
              router.push(`/play/map/${pick.id}?from=home_secondary`);
            }}
            className="rounded-xl border border-concrete-deep px-6 py-4 text-center text-base font-medium transition-colors hover:border-dim hover:bg-paint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            랜덤 도전
          </button>
        </div>
      </section>

      {/*
        메타와 버튼을 한 줄에 둔다. 세로로 쌓으면 내용에 비해 카드가 길어져
        빈 칸이 남는데, 이 카드가 말하는 것은 코스 이름 하나와 기록 하나뿐이다.
      */}
      {/*
        헷갈리는 짝.

        `최근 5번 중 3번 혼동`이라고 쓸 수 없다. 분모를 저장하지 않기 때문이고,
        그럴듯하게 지어내느니 아는 것만 적는다.
      */}
      {data.confusion && (
        <section className="home-confuse relative flex flex-col gap-2 rounded-md bg-paint/70 p-5 pt-4 shadow-[0_1px_0_0_var(--color-concrete-deep)]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-1.5 rounded-sm border border-concrete-deep"
          />
          <h2 className="relative font-mono text-sm text-dim">자꾸 헷갈리는 곳</h2>
          <p className="relative text-2xl font-semibold">
            {data.confusion.a} <span className="text-dim">↔</span>{" "}
            {data.confusion.b}
          </p>
          <p className="relative font-mono text-sm text-alert tabular-nums">
            최근 오답 {data.confusion.count}회
          </p>
          <Link
            href={`/review/${data.confusion.courseId}`}
            className="relative mt-auto rounded-sm bg-concrete-deep px-5 py-2 text-center font-medium transition-colors hover:bg-dim hover:text-paint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            오답 복습
          </Link>
        </section>
      )}

      {/*
        대결은 한 줄로 둔다. 혼자 하는 흐름이 이 서비스의 본체라, 카드로 키우면
        그 흐름을 가로막는다.
      */}
      {/*
        오늘의 퀴즈로 가는 문.

        대결과 같은 한 줄짜리다. 매일 한 번뿐이라 자리를 크게 줄 이유가 없고,
        오히려 늘 같은 자리에 조용히 있는 편이 매일 들르게 만든다.

        아래 탭 바는 넷으로 고정이라(홈·도전·대결·기록) 거기에는 못 넣는다.
        첫 화면에서 시작 버튼 다음에 오는 것이 지금은 대결뿐이라 그 위에 둔다.
      */}
      <DailyLine />

      <section className="home-friends relative flex items-center justify-between gap-4 rounded-md bg-paint/70 px-5 py-3.5 shadow-[0_1px_0_0_var(--color-concrete-deep)] lg:flex-col lg:items-stretch lg:gap-2 lg:p-5 lg:pt-4">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1.5 rounded-sm border border-concrete-deep"
        />
        {/*
          여기는 설명이 한 줄 있어야 하는 자리다. 위 카드들은 무엇인지 이름만
          봐도 알지만(`오늘의 도전`, `대한민국 정복도`) 대결은 처음 보는
          사람에게 무엇이 벌어지는지가 이름만으로 안 그려진다.

          그래도 문장은 아니다. 명사와 숫자로 적고, 좁은 화면에서는 감춘다 —
          거기서는 줄바꿈이 생겨 한 줄짜리가 두 줄이 된다.
        */}
        <span className="relative flex items-baseline gap-3 lg:flex-col lg:items-start lg:gap-1">
          <span className="font-medium lg:font-mono lg:text-sm lg:font-normal lg:text-dim">친구 대결</span>
          <span className="hidden items-baseline gap-3 font-mono text-sm text-dim sm:flex lg:text-lg">
            <span>같은 코스</span>
            <span>최대 8명</span>
          </span>
        </span>
        <Link
          href="/rooms"
          className="relative rounded-sm bg-concrete-deep px-5 py-2 text-center font-medium whitespace-nowrap transition-colors lg:mt-auto hover:bg-dim hover:text-paint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          대결
        </Link>
      </section>
    </main>
  );
}

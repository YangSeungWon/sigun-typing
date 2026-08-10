"use client";

import { useState } from "react";
import Link from "next/link";
import type { CourseGeo } from "@/data/geo/types";
import { useMastery } from "@/lib/useMastery";
import { RegionMap } from "./RegionMap";
import { SignPlate } from "./SignPlate";
import { TypingSurface } from "./TypingSurface";

interface HomeHeroProps {
  geo: CourseGeo;
  /** 오늘의 한 문제 */
  region: { code: string; name: string; aliases: string[] };
  courseId: string;
}

/**
 * 홈에서 바로 한 문제.
 *
 * 이 게임은 설명보다 플레이가 빠르다. 그런데 지금까지는 무슨 게임인지 알려면
 * 코스를 고르고 출발을 눌러야 했다 — 5초면 이해할 것을 세 번 눌러야 알 수
 * 있었던 셈이다. 첫 화면에서 한 곳만 켜 놓고 물어보면 설명이 필요 없다.
 *
 * 뜨자마자 입력창을 잡지 않는다. 홈을 열자마자 휴대폰 키보드가 올라오면
 * 읽으러 온 사람에게는 방해다. 판을 누르면 그때 잡는다.
 */
export function HomeHero({ geo, region, courseId }: HomeHeroProps) {
  const [typed, setTyped] = useState("");
  const [solved, setSolved] = useState(false);
  const [focused, setFocused] = useState(false);
  /*
   * 같은 지도가 두 가지 일을 한다 — 오늘의 문제를 켜고, 내가 아는 곳을
   * 칠한다. 지도를 두 장 놓으면 첫 화면이 다시 무거워진다.
   */
  const { known, confusing } = useMastery(courseId, geo);

  const onType = (value: string) => {
    setTyped(value);
    // 정식 명칭도 통칭도 받는다. 여기서 막히면 첫인상이 "알고 있는데 틀렸다"가 된다.
    if ([region.name, ...region.aliases].includes(value.trim())) setSolved(true);
  };

  return (
    <section className="flex w-full flex-col items-center gap-4">
      <RegionMap
        geo={geo}
        currentCode={region.code}
        passedCodes={solved ? [...known, region.code] : known}
        missedCodes={confusing}
        // 문제를 내는 동안에는 그 한 곳만 노랗다.
        variant={solved ? "route" : "hint"}
        className="h-52 w-auto sm:h-60"
      />

      {known.length > 0 && (
        <p className="font-mono text-sm text-dim">
          {geo.regions.length}곳 중 <span className="text-sign">{known.length}곳</span>{" "}
          익힘
          {confusing.length > 0 && ` · ${confusing.length}곳 헷갈림`}
        </p>
      )}

      {solved ? (
        <p className="py-2 text-2xl font-bold">
          <span className="text-sign">정답</span> — {region.name}
        </p>
      ) : (
        <>
          <p className="text-lg text-dim">여기는 어디일까요?</p>
          <TypingSurface onType={onType} advancedAt={0} autoFocus={false} onFocusChange={setFocused}>
            <SignPlate target={region.name} typed={typed} focused={focused} masked />
          </TypingSurface>
        </>
      )}

      {/*
        주 버튼은 히어로가 갖는다. 이 아래에 같은 버튼을 하나 더 두면 화면에
        초록 표지판이 둘이 되고, 무엇이 먼저인지 알 수 없어진다.
      */}
      <Link
        href={`/play/map/${courseId}?from=${solved ? "home_hero" : "home_primary"}`}
        className="sign-face relative mt-2 w-full rounded-2xl px-8 py-6 text-center shadow-[0_3px_0_0_var(--color-sign-deep)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="pointer-events-none absolute inset-2.5 rounded-xl border-2 border-paint" />
        <span className="relative block text-2xl font-bold text-paint sm:text-3xl">
          {solved ? "이어서 17곳 전부" : "전국 도전 시작"}
        </span>
        <span className="relative mt-1 block font-mono text-sm text-paint/75">
          17개 시·도 모두 맞히기
        </span>
      </Link>
    </section>
  );
}

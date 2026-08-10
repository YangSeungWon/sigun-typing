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

      {solved ? (
        <p className="py-2 text-2xl font-bold">
          <span className="text-sign">정답</span> — {region.name}
        </p>
      ) : (
        /*
         * "여기는 어디일까요?"를 뺐다. 판에 이미 `지역명을 입력하세요`가 있고,
         * 지도에는 한 곳이 노랗게 켜져 있다. 같은 질문이 세 번인 셈이었다.
         */
        <TypingSurface onType={onType} advancedAt={0} autoFocus={false} onFocusChange={setFocused}>
          <SignPlate target={region.name} typed={typed} focused={focused} masked />
        </TypingSurface>
      )}

      {/*
        시작 버튼에서 표지판 옷을 벗겼다.

        입력판도 표지판이고 이 버튼도 표지판이라, 같은 초록 판 두 장이 같은
        폭으로 붙어 있었다. 그러면 형태만으로는 어느 쪽이 치는 곳이고 어느
        쪽이 누르는 곳인지 알 수 없다. 표지판은 이 화면에서 하나여야 하고,
        그 하나는 **답을 쓰는 판**이다. 버튼은 버튼처럼 생기면 된다.
      */}
      <Link
        href={`/play/map/${courseId}?from=${solved ? "home_hero" : "home_primary"}`}
        className="mt-1 w-full rounded-xl bg-sign px-6 py-4 text-center text-xl font-bold text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {solved ? "이어서 17곳 전부" : "전국 17곳 도전"}
      </Link>
    </section>
  );
}

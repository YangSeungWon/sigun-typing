import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { MAX_TRIES, type Closeness } from "@/lib/daily/quiz";

/**
 * 오늘의 퀴즈 공유 그림.
 *
 * 라우트 핸들러로 둔다. 메타데이터 이미지(`opengraph-image.tsx`)로 두면 Next가
 * 주소에 해시를 붙여(`opengraph-image-1kgqh6`) 우리가 그 주소를 맞힐 수 없다.
 * 이 그림은 **링크 미리보기용이 아니라 공유 시트에 넘길 파일**이라 우리가 직접
 * 부를 수 있어야 한다 — `/today`의 미리보기 카드는 모두에게 같아야 하고, 남의
 * 결과가 거기 뜨면 안 된다.
 *
 * **지도를 넣지 않는다.** 결과 화면의 도전장 카드는 코스 지도를 크게 싣는데,
 * 여기서 같은 짓을 하면 그림 한 장이 오늘 문제를 통째로 알려 준다. 받은 사람이
 * 풀 거리가 사라지면 오늘의 퀴즈라는 형식 자체가 무너진다.
 *
 * 정답 이름도, 시도 이름도 없다. 남는 것은 **몇 번 만에 풀었나**뿐이고 그게
 * 이 판의 전부다. 색 블록이 주인공이다.
 *
 * ── 주소에 결과를 담는다 ────────────────────────────────────
 * `/today/card/2-nffh` — 앞이 회차, 뒤가 시도별 색이다. 그림은 서버가 그리므로
 * 주소 말고는 아는 것이 없다. 색 하나가 세 가지뿐이라 글자 하나에 담는다.
 */

const SIZE = { width: 1200, height: 630 };

/** 실제 화면과 같은 색이어야 한다. 카드만 다른 색이면 딴 서비스로 보인다. */
const COLOR = {
  concrete: "#dee0db",
  concreteDeep: "#c7cac3",
  sign: "#0a6b3d",
  paint: "#f7f9f5",
  dim: "#586353",
  centerline: "#f0c420",
  alert: "#c7452b",
};

const FILL: Record<Closeness, string> = {
  hit: COLOR.sign,
  near: COLOR.centerline,
  far: COLOR.alert,
};

/** 주소 한 글자가 색 하나다. 이모지를 주소에 실을 수는 없다. */
const LETTER: Record<string, Closeness> = { h: "hit", n: "near", f: "far" };

async function font(weight: 400 | 700) {
  return readFile(join(process.cwd(), "assets", `pretendard-${weight}.ttf`));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const [rawDay, rawMarks = ""] = decodeURIComponent(code).split("-");

  const day = Number(rawDay);
  const marks = [...rawMarks]
    .map((ch) => LETTER[ch])
    .filter((m): m is Closeness => !!m)
    .slice(0, MAX_TRIES);
  const solved = marks.at(-1) === "hit";

  const fonts = [
    { name: "P", data: await font(400), weight: 400 as const, style: "normal" as const },
    { name: "P", data: await font(700), weight: 700 as const, style: "normal" as const },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
          background: COLOR.concrete,
          color: COLOR.dim,
        }}
      >
        <div style={{ fontSize: 34 }}>시군 타이핑</div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: "#101410" }}>
            오늘의 퀴즈
          </div>
          <div style={{ fontSize: 34 }}>
            {Number.isFinite(day) ? `${day + 1}일차` : ""}
          </div>
        </div>

        {/* 색 블록이 주인공이다. 이 판이 어땠는지는 이 줄이 다 말한다. */}
        <div style={{ display: "flex", gap: 14 }}>
          {marks.map((m, i) => (
            <div
              key={i}
              style={{
                width: 84,
                height: 84,
                borderRadius: 16,
                background: FILL[m],
              }}
            />
          ))}
          {/* 안 쓴 횟수는 빈 자리로 남긴다. 몇 번 만에 풀었나가 눈으로 보인다. */}
          {Array.from({ length: Math.max(0, MAX_TRIES - marks.length) }, (_, i) => (
            <div
              key={`rest-${i}`}
              style={{
                width: 84,
                height: 84,
                borderRadius: 16,
                background: COLOR.concreteDeep,
              }}
            />
          ))}
        </div>

        <div style={{ fontSize: 44, fontWeight: 700, color: "#101410" }}>
          {solved ? `${marks.length} / ${MAX_TRIES}` : `X / ${MAX_TRIES}`}
        </div>

        <div style={{ fontSize: 32 }}>같이 한 판?</div>
      </div>
    ),
    { ...SIZE, fonts },
  );
}

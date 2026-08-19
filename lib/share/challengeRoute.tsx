import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CourseView } from "@/components/CourseView";
import { Game } from "@/components/Game";
import { getCourse } from "@/data/courses";
import type { Course } from "@/data/types";
import { toChallenge, type Challenge } from "@/lib/game/challenge";
import { isModeId, MODE_LABELS } from "@/lib/game/modes";
import type { ModeId } from "@/lib/game/types";
import { loadCourseGeo } from "@/lib/geo";
import { loadCourseGrid } from "./courseGrid";
import { seatOrder } from "./grid";
import { decodeMarks, MARK, type Mark } from "@/lib/game/marks";

/**
 * 도전장 한 장을 이루는 것들 — 화면, 카드 문구, 카드 그림.
 *
 * 주소가 둘이라 여기 모은다.
 *
 *   /c/map/seoul/41080          이름 없이 보낸 도전장
 *   /c/map/seoul/41080/승원      이름과 함께
 *
 * 하나로 두고 싶었다(`[[...by]]`). 그런데 Next는 catch-all 뒤에 고정 세그먼트를
 * 두지 못하고, `opengraph-image`가 바로 그 고정 세그먼트다. 그림을 포기하거나
 * 주소에 `-` 같은 자리표시자를 넣는 대신 경로를 둘로 나눴다. 대신 **알맹이는
 * 여기 한 번만** 적는다 — 나뉘어도 되는 것은 파일이지 규칙이 아니다.
 */

export const CARD_SIZE = { width: 1200, height: 630 };

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

interface Resolved {
  course: Course;
  mode: ModeId;
  challenge: Challenge;
  /** 칸 순서대로의 지역별 결과. 옛 링크에는 없다. */
  marks: Mark[] | null;
}

export function resolve(
  mode: string,
  courseId: string,
  beat: string,
  by: string | null,
): Resolved | null {
  const course = getCourse(courseId);
  if (!course || !isModeId(mode)) return null;

  /*
   * 기록 칸은 `41080` 또는 `41080~<꾸러미>`다. 뒤엣것이 지역별 결과이고,
   * 이 장치가 생기기 전에 나간 링크에는 없다. 없으면 지도를 한 색으로 그린다.
   */
  const [ms, packed] = beat.split("~");
  const challenge = toChallenge(ms, by === null ? null : decodeURIComponent(by));
  if (!challenge) return null;

  const grid = loadCourseGrid(course.id);
  const marks =
    grid && packed ? decodeMarks(packed, seatOrder(grid).length) : null;
  return { course, mode, challenge, marks };
}

/** 사람이 읽는 기록. 공유 메시지와 같은 말투여야 한다. */
function spoken(ms: number): string {
  const total = ms / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = (total % 60).toFixed(2);
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

export function metadata(found: Resolved | null) {
  if (!found) return {};
  const { course, mode, challenge } = found;
  /*
   * 카드가 하는 말이 곧 도발이다. 링크를 누르기 전에 이미 승부가 걸려 있어야
   * 하고, 그게 이런 게임이 퍼지는 방식이다. 가운데점은 쓰지 않는다.
   */
  const who = challenge.by ? `${challenge.by}님의 기록` : "받은 기록";
  const title = `${course.name} ${spoken(challenge.beatMs)}`;
  const description = `${who}입니다. ${MODE_LABELS[mode]}으로 넘어설 수 있나요?`;
  return {
    title,
    description,
    // 도전장은 검색에 오를 물건이 아니다. 링크를 받은 사람만 오는 자리다.
    robots: { index: false, follow: true },
    openGraph: { title: `${title} — 시군 타이핑`, description },
  };
}

export async function screen(found: Resolved) {
  const { course, mode, challenge } = found;
  const geo = await loadCourseGeo(course.id);
  return (
    <>
      <CourseView courseId={course.id} mode={mode} />
      <Game
        course={course}
        mode={mode}
        geo={geo}
        grid={loadCourseGrid(course.id)}
        challenge={challenge}
      />
    </>
  );
}

/**
 * satori는 woff2를 못 읽는다. 저장소의 한글 폰트가 woff2뿐이라 이 길이 막혀
 * 있었고(scripts/build-og.mts 참조), 이번에 실제로 쓰이는 글자만 남긴 ttf를
 * 넣어 풀었다. 만드는 법은 scripts/build-og-font.sh에 있다.
 */
async function font(weight: 400 | 700) {
  return readFile(join(process.cwd(), "assets", `pretendard-${weight}.ttf`));
}

/**
 * 카드 그림.
 *
 * 지도를 그린다. 공유 메시지의 이모지 격자와 같은 자리표를 쓰되 색은 안 칠한다 —
 * 주소에 실려 오는 것은 기록뿐이라 누가 어디를 틀렸는지 알 수 없다. 받은 사람이
 * 카드에서 먼저 알아야 할 것도 "무엇을 푸는 판인가"이고, 그건 이름보다 모양이
 * 빠르다.
 */
export async function card(found: Resolved | null) {
  const fonts = [
    { name: "P", data: await font(400), weight: 400 as const, style: "normal" as const },
    { name: "P", data: await font(700), weight: 700 as const, style: "normal" as const },
  ];

  // 값이 어그러진 주소는 화면이 404지만 그림은 따로 요청된다. 소개 카드로 떨어뜨린다.
  if (!found) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLOR.concrete,
            color: COLOR.sign,
            fontSize: 72,
            fontWeight: 700,
          }}
        >
          시군 타이핑
        </div>
      ),
      { ...CARD_SIZE, fonts },
    );
  }

  const { course, challenge, marks } = found;
  const grid = loadCourseGrid(course.id);
  const time = spoken(challenge.beatMs);
  /*
   * 이모지 격자와 같은 색으로 칠한다. 같은 판의 두 그림이 서로 다른 말을 하면
   * 안 된다. 꾸러미가 없는 옛 링크에서는 전부 초록으로 세운다 — 그때는 모양만
   * 말하는 지도다.
   */
  const seats = grid ? seatOrder(grid) : [];
  const markAt = new Map(seats.map((code, i) => [code, marks?.[i] ?? MARK.clean]));
  const FILL: Record<Mark, string> = {
    [MARK.clean]: COLOR.sign,
    [MARK.struggled]: COLOR.centerline,
    [MARK.missed]: COLOR.alert,
  };
  /*
   * 칸 크기는 격자에 맞춘다. 전국은 19×19라 칸이 작아지고 제주는 2×1이라
   * 커진다. 어느 쪽이든 오른쪽 자리 안에 들어와야 글자와 부딪히지 않는다.
   */
  const cell = grid
    ? Math.max(6, Math.min(44, Math.floor(Math.min(420 / grid.cols, 380 / grid.rows))))
    : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: COLOR.concrete,
          padding: 64,
          gap: 56,
        }}
      >
        {/* 표지판 판면 위에 이름과 기록. 완주 화면과 같은 문법이다. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: COLOR.sign,
            border: `6px solid ${COLOR.paint}`,
            borderRadius: 28,
            padding: "44px 48px",
            color: COLOR.paint,
          }}
        >
          <div style={{ fontSize: 34, opacity: 0.85 }}>
            {challenge.by ? `${challenge.by}님의 기록` : "받은 기록"}
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, marginTop: 10 }}>{course.name}</div>
          {/*
            한 줄로 세운다. `12분 34.22초`가 두 줄로 접히면 판면이 숫자에 밀려
            아래 문구가 잘린다. 길이에 따라 크기를 줄이되 아래로는 한계를 둔다 —
            카드에서 제일 큰 글자가 기록이어야 한다.
          */}
          <div
            style={{
              fontSize: Math.max(64, Math.min(108, Math.floor(560 / time.length))),
              fontWeight: 700,
              marginTop: 18,
              color: COLOR.centerline,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            {time}
          </div>
          <div style={{ fontSize: 32, marginTop: 22, opacity: 0.9 }}>넘어설 수 있나요</div>
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}
        >
          {grid && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Array.from({ length: grid.rows }, (_, y) => (
                <div key={y} style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: grid.cols }, (_, x) => (
                    <div
                      key={x}
                      style={{
                        width: cell,
                        height: cell,
                        borderRadius: Math.max(1, Math.floor(cell / 6)),
                        background: (() => {
                          const code = grid.cells[y * grid.cols + x];
                          return code ? FILL[markAt.get(code)!] : COLOR.concreteDeep;
                        })(),
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 30, fontWeight: 700, color: COLOR.dim }}>시군 타이핑</div>
        </div>
      </div>
    ),
    { ...CARD_SIZE, fonts },
  );
}

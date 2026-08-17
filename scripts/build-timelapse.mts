/**
 * 시도 경계가 50년 동안 어떻게 바뀌었는지를 프레임으로 굽는다.
 *   실행: `npm run build:timelapse`
 *
 * 원본은 `build-changes.mts`와 같은 SGIS 자료다(`data/geo/source/sgis/`).
 *
 * **31개 시점을 다 굽지 않는다.** 시도 경계가 실제로 달라지는 순간은 아홉
 * 번뿐이고, 나머지 스물두 해는 앞 해와 같은 지도다. 전부 구우면 파일만
 * 세 배가 되고, 해마다 미세하게 다른 원본 정밀도 때문에 아무 일도 없는
 * 해에 해안선이 떠는 것처럼 보인다.
 *
 * 결과는 `data/timelapse/sido.json`. 지도가 아니라 **미리 계산한 SVG path**다
 * — `build-geo.mts`와 같은 방식이라 브라우저는 d3도 topojson도 필요 없다.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import changes from "../data/reference/boundary-changes.json" with { type: "json" };
import { SIDO_EVENT_BY_YEAR } from "../data/reference/sido-events.ts";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "data/geo/source/sgis");
const OUT = join(ROOT, "data/timelapse/sido.json");

/** 그리는 판. 세로가 조금 긴 것은 남북으로 긴 나라이기 때문이다. */
const WIDTH = 640;
const HEIGHT = 760;

/**
 * 축약은 **비율이 아니라 해상도로** 건다.
 *
 * `build-geo.mts`는 비율(20%)을 쓴다. 거기서는 원본이 한 벌뿐이라 그래도 된다.
 * 여기는 서른한 시점을 나란히 놓는데 **원본 정밀도가 시점마다 다르다** —
 * 시도 경계 파일이 1975~2012년에는 5.7MB인데 2023년부터 55MB로 열 배 뛴다.
 *
 * 비율로 깎으면 남는 점이 1975년 400개, 2024년 3,150개가 된다. 그러면
 * 타임랩스 중간에 해안선이 갑자기 또렷해져서, 행정구역이 그대로인 해에도
 * 지도가 바뀐 것처럼 보인다. 이 페이지가 보여 주려는 것과 정반대다.
 *
 * 해상도로 걸면 어느 시점이든 "이 크기의 화면에 필요한 만큼"만 남아 정밀도가
 * 고르다. 판보다 조금 높게 잡아 확대에 여유를 둔다.
 */
const SIMPLIFY_RESOLUTION = "640x760";

/**
 * 이보다 작은 섬은 그리지 않는다(원본 좌표계 기준 제곱미터).
 *
 * `keep-shapes`가 도형을 지우지 않으므로, 축약을 세게 걸면 작은 섬이 점 서넛짜리
 * 삼각형으로 남는다. 전국 축척에서 그건 섬이 아니라 티끌로 보인다 — 남해에
 * 정체를 알 수 없는 조각이 흩어져 있는 것이 그것이었다.
 *
 * 울릉도(약 72㎢)와 제주는 넉넉히 살아남는 값이다.
 */
const MIN_ISLAND_AREA = 20_000_000;

/**
 * 자료가 틀린 자리는 굽지 않는다.
 *
 * 제주특별자치도는 2006년에 출범한 뒤 되돌아간 적이 없는데, SGIS 2009년 판만
 * `제주도`로 적혀 있다. 그대로 두면 타임랩스에서 제주가 이름을 되돌렸다가 다시
 * 바꾸는 장면이 나온다 — 일어나지 않은 일이다.
 * (`data/reference/boundary-changes.json`의 _caveats)
 */
const SOURCE_ERRORS = new Set(["2009", "2010"]);

interface Frame {
  /**
   * 화면에 크게 뜨는 해 — **실제로 그 일이 있었던 해**다.
   *
   * 지도의 연도가 아니다. 경계 자료가 1975~2000년은 5년 단위라, 그 사이 어느
   * 날 일어난 일이 다음 판에 처음 나타날 뿐이다 — 대구·인천직할시는 1981년에
   * 생겼는데 자료에서는 1985년 판에서 처음 보인다. 그대로 두면 화면이
   * "1985년에 대구직할시가 생겼다"고 말하게 된다.
   *
   * 실제 날짜는 도형에서 나오지 않으므로 `data/reference/sido-events.ts`에
   * 손으로 적어 두었다. 한 지도에 두 사건이 묶이면 구간이 된다(`1986–1989`).
   */
  year: string;
  /** 눈금에 적을 짧은 해. 구간이면 앞의 것. */
  tick: string;
  /** 이 그림이 실제로는 몇 년 판인가. year와 다를 때만 화면에 밝힌다. */
  mapYear: string;
  /** 무슨 일이 있었는지. 첫 프레임은 출발점이라 비어 있다. */
  label: string;
  /**
   * 이 해에 달라진 지역의 코드.
   *
   * 지도가 다시 그려지기만 하면 무엇이 바뀌었는지 안 보인다 — 인천이 경기도에서
   * 떨어져 나온 해에도 그냥 지도 한 장이다. 여기 담긴 곳을 화면에서 다른 색으로
   * 칠한다.
   *
   * 사건 목록을 이름으로 맞추지 않고 **앞 프레임의 도형과 직접 견준다.** 이름은
   * 표기가 흔들리지만 코드는 31년 내내 고정이다.
   */
  changed: string[];
  regions: { code: string; name: string; d: string }[];
}

/** 한 해치 zip에서 시도 경계를 꺼내 투영 전 GeoJSON으로. */
async function readYear(year: string, file: string): Promise<Feature<Geometry>[]> {
  const dir = await mkdtemp(join(tmpdir(), `tl-${year}-`));
  try {
    await run("unzip", ["-q", "-o", join(SOURCE_DIR, file), "bnd_sido_*", "-d", dir]);
    const inner = (await readdir(dir)).find((f) => f.endsWith(".zip"));
    if (!inner) throw new Error(`${year}: 안쪽 zip 없음`);
    await run("unzip", ["-q", "-o", join(dir, inner), "-d", dir]);

    const base = (await readdir(dir)).find((f) => f.endsWith(".shp"))?.replace(/\.shp$/, "");
    if (!base) throw new Error(`${year}: shp 없음`);

    const mapshaper = (await import("mapshaper")).default;
    /*
     * `.prj`가 든 해와 안 든 해가 있어 원본을 믿지 않고 from=으로 못 박는다.
     * 축약 전에 -clean으로 위상을 세워야 맞닿은 경계가 따로 놀지 않는다.
     */
    const result = await mapshaper.applyCommands(
      // 티끌 섬은 투영 전에, 원본 미터 좌표에서 넓이로 거른다.
      `-i in.shp -filter-islands min-area=${MIN_ISLAND_AREA} ` +
        "-proj from=EPSG:5179 wgs84 -clean " +
        `-simplify visvalingam resolution=${SIMPLIFY_RESOLUTION} keep-shapes ` +
        "-o out.json format=topojson",
      {
        "in.shp": await readFile(join(dir, `${base}.shp`)),
        "in.dbf": await readFile(join(dir, `${base}.dbf`)),
      },
    );

    const topo = JSON.parse(Buffer.from(result["out.json"]).toString()) as Topology;
    const key = Object.keys(topo.objects)[0];
    const fc = feature(topo, topo.objects[key] as GeometryCollection) as FeatureCollection;
    return fc.features;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** 필드 이름이 해마다 다르다(sido_cd / SIDO_CD). 대소문자를 낮춰 찾는다. */
function propOf(props: Record<string, unknown> | null, suffix: string): string {
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.toLowerCase().endsWith(suffix)) return String(v);
  }
  return "";
}

const files = (await readdir(SOURCE_DIR).catch(() => [])).filter((f) => f.startsWith("bnd_all"));
if (files.length === 0) {
  throw new Error(
    `${SOURCE_DIR}에 원본이 없다.\n` +
      "SGIS(sgis.mods.go.kr)에서 센서스용 행정구역경계를 신청해 받은 zip을 그 폴더에 둔다.",
  );
}
const fileOf = (y: string): string | undefined => files.find((f) => f.includes(`_${y}_`));

/*
 * 구울 해를 고른다 — 출발점 하나에 실제로 바뀐 해들.
 * 무엇이 바뀌었는지는 이미 뽑아 둔 사건 목록에서 그대로 읽는다.
 */
const first = [...new Set(files.map((f) => f.match(/_(\d{4})_/)?.[1]).filter(Boolean))].sort()[0]!;
const milestones: { year: string; label: string }[] = [
  { year: first, label: "" },
  ...changes.sido
    .filter((e) => !SOURCE_ERRORS.has(e.to))
    .map((e) => ({
      year: e.to,
      label: [...e.born.map((n) => `${n} 신설`), ...e.gone.map((n) => `${n} 폐지`), ...e.renamed].join(
        ", ",
      ),
    })),
];

process.stdout.write(`프레임 ${milestones.length}개 · ${first} ~ ${milestones.at(-1)!.year}\n`);

/*
 * 투영은 **한 번만** 잡아 모든 프레임이 공유한다.
 *
 * 프레임마다 자기 범위에 맞추면 나라 전체가 미세하게 커졌다 작아지며 흔들린다.
 * 바뀐 것은 안쪽 경계인데 지도가 통째로 움직이면 무엇이 달라졌는지 안 보인다.
 */
const loaded: { year: string; label: string; features: Feature<Geometry>[] }[] = [];
for (const m of milestones) {
  const file = fileOf(m.year);
  if (!file) {
    process.stdout.write(`  ${m.year} 원본 없음 — 건너뜀\n`);
    continue;
  }
  loaded.push({ ...m, features: await readYear(m.year, file) });
  process.stdout.write(`  ${m.year} ${loaded.at(-1)!.features.length}개\n`);
}

const projection = geoMercator().fitExtent(
  [
    [8, 8],
    [WIDTH - 8, HEIGHT - 8],
  ],
  { type: "FeatureCollection", features: loaded.flatMap((f) => f.features) } as FeatureCollection,
);
const path = geoPath(projection).digits(1);

let previous = new Map<string, string>();
const frames: Frame[] = loaded.map(({ year, label, features }, i) => {
  const regions = features
    .map((f) => ({
      code: propOf(f.properties, "_cd"),
      name: propOf(f.properties, "_nm"),
      d: path(f) ?? "",
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  /*
   * 첫 프레임은 견줄 앞이 없다. 그렇다고 아무것도 안 짚으면 출발점이 빈
   * 지도가 되는데, 이 타임랩스의 이야기는 **도에서 도시가 하나씩 파여
   * 나오는 것**이라 출발점에도 주인공이 있다 — 1975년에는 서울과 부산
   * 둘뿐이었다. 그 둘을 짚어 두면 뒤 프레임들이 같은 패턴을 이어받는다.
   *
   * 도가 아닌 것이 곧 그것이다(특별시·직할시·광역시·특별자치시).
   */
  const changed =
    i === 0
      ? regions.filter((r) => !r.name.endsWith("도")).map((r) => r.code)
      : regions.filter((r) => previous.get(r.code) !== r.name).map((r) => r.code);

  previous = new Map(regions.map((r) => [r.code, r.name]));

  /*
   * 실제 날짜가 있으면 그것이 이 프레임의 해다.
   *
   * 없으면 지도의 해를 그대로 쓴다 — 2001년부터는 자료가 1년 단위라 지도의
   * 해와 실제 해가 한 해 안에서 만나므로 크게 어긋나지 않는다.
   */
  const known = SIDO_EVENT_BY_YEAR.get(year);
  const yearsOf = known ? [...new Set(known.dates.map((d) => d.on.slice(0, 4)))] : [];
  const shown =
    yearsOf.length === 0
      ? year
      : yearsOf.length === 1
        ? yearsOf[0]
        : `${yearsOf[0]}–${yearsOf.at(-1)}`;

  return {
    year: shown,
    tick: yearsOf[0] ?? year,
    mapYear: year,
    /*
     * 라벨도 손으로 적은 쪽을 먼저 쓴다. 도형에서 뽑은 문장은 무엇이
     * 달라졌는지는 정확하지만(`제주도 → 제주특별자치도`) 그것이 승격인지
     * 개칭인지는 말해 주지 못한다.
     */
    label: known
      ? known.dates.map((d) => `${d.on.slice(0, 4)}년 ${d.what}`).join(" · ")
      : // 출발점의 라벨은 사건이 아니라 그 주인공들이다.
        label || changed.map((c) => regions.find((r) => r.code === c)!.name).join(", "),
    changed,
    regions,
  };
});

const empty = frames.flatMap((f) => f.regions.filter((r) => !r.d).map((r) => `${f.year} ${r.name}`));
if (empty.length) throw new Error(`도형이 비었습니다: ${empty.join(", ")}`);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  `${JSON.stringify({
    _source: "통계청 SGIS 센서스용 행정구역경계",
    _note: "시도 경계가 실제로 달라진 해만 굽는다. npm run build:timelapse로 다시 만든다.",
    width: WIDTH,
    height: HEIGHT,
    frames,
  })}\n`,
);

const kb = Math.round(JSON.stringify(frames).length / 1024);
process.stdout.write(`\n${OUT}\n프레임 ${frames.length}개 · ${kb}KB\n`);

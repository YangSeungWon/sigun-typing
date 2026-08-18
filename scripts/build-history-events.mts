/**
 * 행정구역 개편 사건마다 전후 지도를 굽는다.  실행: `npm run build:events`
 *
 * `/history`의 타임랩스는 전국 시도만 보여 준다. 시군구 개편은 그 축척에서
 * 몇 픽셀이라 — 창원 통합도 청주 통합도 안 보인다. 사건은 **자기 자리를
 * 확대해야** 보인다.
 *
 * 그래서 사건마다 그 일이 일어난 시도만 잘라, 그해와 앞 시점을 같은 투영으로
 * 나란히 굽는다. 바뀐 곳은 표시해 두었다가 화면에서 다르게 칠한다.
 *
 * 사건은 **연도로 묶는다.** 2012년 세종 신설은 시도에도 시군구에도 걸리지만
 * 한 사건이다.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoBounds, geoCentroid, geoContains, geoDistance, geoMercator, geoPath } from "d3-geo";
import polylabel from "polylabel";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import changes from "../data/reference/boundary-changes.json" with { type: "json" };
import {
  DONG_EVENTS,
  SIDO_EVENT_BY_YEAR,
  SIGUNGU_EVENT_BY_YEAR,
  SOURCE_NAME_FIXES,
} from "../data/reference/admin-events.ts";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "data/geo/source/sgis");
const OUT = join(ROOT, "data/timelapse/events.json");

/**
 * 그리는 판.
 *
 * 보통은 사건이 일어난 시도 하나를 담으므로 정사각이면 된다. 도농통합처럼
 * 전국에 걸친 사건은 나라 전체를 담아야 해서 세로로 길다.
 */
const LOCAL = { width: 460, height: 460 };
const NATIONWIDE = { width: 520, height: 660 };

/** 잘라 낸 시도 하나를 이 판에 담으므로 전국 타임랩스보다 곱게 남긴다. */
const RESOLUTION = "900x900";
/**
 * 이보다 작은 섬 조각은 버린다. 원본 좌표계(EPSG:5179) 제곱미터다.
 *
 * 20㎢였다. 그런데 영도가 14㎢라 영도구가 통째로 사라졌고, 그 판정이
 * 해마다 흔들려 2013년에 `영도구 생김`, 2016년에 `영도구 사라짐`이라는
 * 있지도 않은 사건이 적혔다. 지역 하나를 통째로 지우는 잣대는 잣대가
 * 아니다 — 섬으로만 이루어진 시군구가 있다.
 */
const MIN_ISLAND_AREA = 1_000_000;

/** 제주 2009·2010은 원본의 오류다(boundary-changes.json의 _caveats). */
const SOURCE_ERRORS = new Set(["2009", "2010"]);

type Level = "sido" | "sigungu" | "dong";

/**
 * 시도 접두사 → 이름.
 *
 * 시군구를 그릴 때는 시도 도형이 손에 없는데, 이름이 같아 헷갈리는 자리에서만
 * 어느 시도인지 밝히면 된다. 원본의 옛 코드 체계다(부산은 26이 아니라 21).
 */
const SIDO_LABEL: Record<string, string> = {
  "11": "서울", "21": "부산", "22": "대구", "23": "인천", "24": "광주",
  "25": "대전", "26": "울산", "29": "세종", "31": "경기", "32": "강원",
  "33": "충북", "34": "충남", "35": "전북", "36": "전남", "37": "경북",
  "38": "경남", "39": "제주",
};

interface Shape {
  code: string;
  name: string;
  d: string;
  /** 지도에 이름을 적을 자리. 짚은 곳에만, 그리고 몇 곳 안 될 때만 붙는다. */
  at?: [number, number];
  /** 지도에 적을 짧은 이름. 판이 한 도시에 맞춰져 있으면 시 이름은 군더더기다. */
  label?: string;
}

interface Side {
  /** 단추에 적을 시점. `2011`이거나 `2012.01`이다. */
  year: string;
  regions: Shape[];
  /** 이 시점에서 눈여겨볼 곳. */
  marked: string[];
  /** 짚은 것이 사라질 것인가 생긴 것인가. 화면의 색이 갈린다. */
  tone: "gone" | "born";
}

interface Named {
  name: string;
  /** 지도에서 짚을 도형. 이름이 도형과 안 맞으면 없다. */
  code?: string;
}

interface Change {
  /** 시행일. 손으로 적은 것이 있을 때만. */
  on?: string;
  from: Named[];
  to: Named[];
}

interface Event {
  /** 자료에 처음 나타난 해. 주소가 되므로 바뀌면 안 된다. */
  year: string;
  /** 이 사건의 판 크기. 전국에 걸친 사건은 더 길다. */
  width: number;
  height: number;
  /** 전국에 걸친 사건인가. 화면이 문구를 달리한다. */
  nationwide: boolean;
  /**
   * 크게 뜨는 해 — 실제로 그 일이 있었던 해다.
   *
   * 자료의 해가 아니다. 1년 단위인 2001년 이후에도 자료가 개편을 곧바로
   * 따라가지 않는다(제주는 2006년 출범인데 2007년 판에서야 바뀐다).
   * 손으로 적어 둔 것이 있으면 그것을, 없으면 자료의 해를 쓴다.
   */
  at: string;
  /** 실제 날짜를 아는가. 모르면 화면이 "자료에 처음 나타난 해"라고 밝힌다. */
  dated: boolean;
  /**
   * 무엇이 무엇으로 바뀌었는지. **문장이 아니라 짝**이다.
   *
   * 화면이 표로 그린다. 문장으로 넘기면 여러 건이 겹칠 때 가운뎃점으로
   * 늘어놓게 되고, 그러면 눈이 세로로 훑을 수가 없다.
   */
  changes: Change[];
  /** 제목·설명에 쓸 한 줄. 표를 글로 옮긴 것이라 화면에는 안 쓴다. */
  headline: string;
  /**
   * 앞에서 뒤로 가는 상태들. 보통 둘(전·후)이다.
   *
   * 한 판에 사건이 둘이면 셋이 된다 — 2012년에는 당진시(1월 1일)와
   * 세종시(7월 1일)가 함께 나타나는데, 그 사이 반년의 지도가 따로 있다.
   */
  states: Side[];
}

function prop(props: Record<string, unknown> | null | undefined, suffix: string): string {
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.toLowerCase().endsWith(suffix)) return String(v);
  }
  return "";
}

/**
 * 도형 **안쪽**의 한 점.
 *
 * 한가운데(centroid)는 도형 밖에 있을 수 있다. 월성군은 경주시를 고리처럼
 * 두르고 있어 한가운데가 경주시 안이고, 옹진군은 섬들이라 한가운데가 바다다.
 * 그대로 쓰면 월성군이 경주시에 흡수된 것으로, 옹진군은 아무 데도 안 들어간
 * 것으로 적힌다.
 *
 * polylabel은 다각형 안에서 경계로부터 가장 먼 점을 찾는다. 조각이 여럿이면
 * 가장 큰 조각에서 찾는다 — 그 조각이 그 지역을 대표한다.
 */
function inside(f: Feature<Geometry>): [number, number] {
  const g = f.geometry;
  const polys =
    g.type === "Polygon"
      ? [g.coordinates]
      : g.type === "MultiPolygon"
        ? g.coordinates
        : [];
  if (polys.length === 0) return geoCentroid(f as Parameters<typeof geoCentroid>[0]) as [number, number];

  const area = (ring: number[][]) =>
    Math.abs(
      ring.reduce((sum, p, i) => {
        const q = ring[(i + 1) % ring.length];
        return sum + (p[0] * q[1] - q[0] * p[1]);
      }, 0),
    ) / 2;
  const biggest = polys.reduce((a, b) => (area(b[0]) > area(a[0]) ? b : a));
  return polylabel(biggest as [number, number][][], 0.001) as [number, number];
}

const cache = new Map<string, Feature<Geometry>[]>();

/** 한 해치 zip에서 한 층의 경계를 읽는다. 같은 해를 여러 사건이 쓰므로 캐시한다. */
async function read(year: string, level: Level, file: string): Promise<Feature<Geometry>[]> {
  const key = `${year}:${level}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const dir = await mkdtemp(join(tmpdir(), `ev-${year}-`));
  try {
    // 2021년만 안쪽 파일이 `01.bnd_dong_…`처럼 접두사를 달고 있다.
    await run("unzip", ["-q", "-o", join(SOURCE_DIR, file), `*bnd_${level}_*`, "-d", dir]);
    const inner = (await readdir(dir)).find((f) => f.endsWith(".zip"));
    if (!inner) throw new Error(`${year} ${level}: 안쪽 zip 없음`);
    await run("unzip", ["-q", "-o", join(dir, inner), "-d", dir]);
    const base = (await readdir(dir)).find((f) => f.endsWith(".shp"))?.replace(/\.shp$/, "");
    if (!base) throw new Error(`${year} ${level}: shp 없음`);

    const mapshaper = (await import("mapshaper")).default;
    const result = await mapshaper.applyCommands(
      `-i in.shp -filter-islands min-area=${MIN_ISLAND_AREA} ` +
        "-proj from=EPSG:5179 wgs84 -clean " +
        `-simplify visvalingam resolution=${RESOLUTION} keep-shapes ` +
        "-o out.json format=topojson",
      {
        "in.shp": await readFile(join(dir, `${base}.shp`)),
        "in.dbf": await readFile(join(dir, `${base}.dbf`)),
      },
    );
    const topo = JSON.parse(Buffer.from(result["out.json"]).toString()) as Topology;
    const objKey = Object.keys(topo.objects)[0];
    const fc = feature(topo, topo.objects[objKey] as GeometryCollection) as FeatureCollection;

    // 원본이 잘못 적어 둔 이름을 바로잡는다(admin-events.ts의 SOURCE_NAME_FIXES).
    for (const fix of SOURCE_NAME_FIXES) {
      if (fix.year !== year || fix.level !== level) continue;
      for (const f of fc.features) {
        const props = f.properties as Record<string, unknown>;
        if (prop(props, "_cd") !== fix.code || prop(props, "_nm") !== fix.from) continue;
        for (const k of Object.keys(props)) {
          if (k.toLowerCase().endsWith("_nm")) props[k] = fix.to;
        }
      }
    }

    cache.set(key, fc.features);
    return fc.features;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const files = (await readdir(SOURCE_DIR).catch(() => [])).filter((f) => f.startsWith("bnd_all"));
if (files.length === 0) {
  throw new Error(`${SOURCE_DIR}에 원본이 없다. SGIS에서 신청해 받은 zip을 두세요.`);
}
const fileOf = (y: string) => files.find((f) => f.includes(`_${y}_`));
const years = [...new Set(files.map((f) => f.match(/_(\d{4})_/)?.[1]).filter(Boolean))].sort() as string[];

/*
 * 연도별로 사건을 모은다. 같은 해에 시도와 시군구가 함께 바뀌면 한 사건이다 —
 * 2012년의 세종이 그렇다.
 */
const byYear = new Map<string, { sido?: (typeof changes.sido)[number]; sigungu?: (typeof changes.sigungu)[number] }>();
for (const e of changes.sido) {
  if (SOURCE_ERRORS.has(e.to)) continue;
  byYear.set(e.to, { ...(byYear.get(e.to) ?? {}), sido: e });
}
for (const e of changes.sigungu) {
  byYear.set(e.to, { ...(byYear.get(e.to) ?? {}), sigungu: e });
}

const events: Event[] = [];

/**
 * 원본 자료의 해 → 그 해에 무엇이 무엇으로 바뀌었는가.
 *
 * `/history` 목록이 쓴다. 이름만 담는다 — 그 페이지는 도형이 필요 없고,
 * 사건 전체를 가져오면 3MB가 딸려 온다.
 */
const summaries: Record<string, { dated?: boolean; from: string[]; to: string[] }[]> = {};

for (const [year, group] of [...byYear].sort()) {
  const prevYear = years[years.indexOf(year) - 1];
  if (!prevYear) continue;
  const [fileNow, filePrev] = [fileOf(year), fileOf(prevYear)];
  if (!fileNow || !filePrev) continue;

  /*
   * 어느 층을 그릴지 정한다.
   *
   * 시군구가 바뀐 해는 시군구를 그린다 — 시도만 그리면 창원 통합이 아무것도
   * 아닌 것처럼 보인다. 시도만 바뀐 해는 시도를 그린다.
   */
  const level: Level = group.sigungu ? "sigungu" : "sido";

  const [now, prev] = [await read(year, level, fileNow), await read(prevYear, level, filePrev)];
  const nameOf = (f: Feature<Geometry>) => prop(f.properties, "_nm");
  const codeOf = (f: Feature<Geometry>) => prop(f.properties, "_cd");

  /*
   * 무엇이 바뀌었는지 **도형으로 직접 가른다.**
   *
   * 사건 목록(boundary-changes.json)은 이름만 갖고 있어서 여기 쓸 수 없다 —
   * `남구`가 여섯 도시에 있어, 인천 남구가 미추홀구로 바뀐 해에 부산·대구·
   * 울산·광주의 남구까지 딸려 온다. 정체성은 시도 접두사와 이름이다
   * (build-changes.mts와 같은 규칙).
   */
  const key = (f: Feature<Geometry>) => `${codeOf(f).slice(0, 2)}:${nameOf(f).replace(/\s+/g, "")}`;
  const prevKeys = new Set(prev.map(key));
  const nowKeys = new Set(now.map(key));
  const bornSet = new Set(now.filter((f) => !prevKeys.has(key(f))).map(codeOf));
  const goneSet = new Set(prev.filter((f) => !nowKeys.has(key(f))).map(codeOf));

  /*
   * 바뀐 곳이 속한 시도만 남긴다. 전국을 그리면 다시 안 보이고, 바뀐 곳만
   * 그리면 어디인지 알 수 없다 — 그 도(道) 하나가 알맞은 그릇이다.
   */
  const touched = new Set(
    [
      ...now.filter((f) => bornSet.has(codeOf(f))),
      ...prev.filter((f) => goneSet.has(codeOf(f))),
    ].map((f) => codeOf(f).slice(0, 2)),
  );
  if (touched.size === 0) continue;

  /*
   * 시도 셋 이상에 걸치면 **전국을 그린다.**
   *
   * 확대할 자리가 없어서 건너뛰었는데, 그건 그릴 수 없는 사건이 아니라
   * 다른 그림이 필요한 사건이었다. 도농통합처럼 온 나라에서 동시에 일어난
   * 일은 하나를 자세히 보는 게 아니라 **얼마나 많이 바뀌었나**를 보는
   * 사건이라, 전국에 색이 드는 것 자체가 그 이야기다.
   */
  const nationwide = touched.size > 2;
  const { width: WIDTH, height: HEIGHT } = nationwide ? NATIONWIDE : LOCAL;

  const inScope = (f: Feature<Geometry>) =>
    nationwide || touched.has(codeOf(f).slice(0, 2));
  const nowIn = now.filter(inScope);
  const prevIn = prev.filter(inScope);

  /*
   * **바뀐 자리에 판을 맞춘다.**
   *
   * 도 전체에 맞췄더니 2014년 청주가 판의 5분의 1이었다. 사건은 자기 자리를
   * 확대해야 보인다는 것이 이 페이지가 있는 이유인데, 도 하나는 아직 넓다.
   *
   * 바뀐 곳들의 테두리를 잡아 그만큼 넓힌 네모에 맞춘다. 배로 넓히므로 바뀐
   * 곳이 판의 절반쯤을 차지하고, 나머지 절반이 이웃이다 — 어디인지 알려면
   * 둘레가 있어야 한다. 밖으로 밀려난 것은 판이 잘라 낸다.
   *
   * 전국에 걸친 사건은 좁힐 자리가 없다. 그때는 온 나라가 그 자리다.
   */
  const focus = [
    ...prevIn.filter((f) => goneSet.has(codeOf(f))),
    ...nowIn.filter((f) => bornSet.has(codeOf(f))),
  ];

  /** 바뀐 곳 둘레로 얼마나 더 볼 것인가. 1이면 딱 맞고, 2면 둘레가 절반이다. */
  const PAD = 2;

  /**
   * 아무리 좁혀도 이만큼은 보여 준다. 위경도 도(度) 단위다.
   *
   * 배로만 넓혔더니 인천 남구 하나짜리 사건에서 그 구가 판을 꽉 채웠다.
   * 도형은 큰데 어디인지는 알 수 없는 그림이다 — 작은 곳일수록 둘레가
   * 더 필요하다. 0.45도면 사방 40km쯤이라 그 도시가 통째로 들어온다.
   */
  const MIN_SPAN = 0.45;

  // 투영은 두 시점이 함께 쓴다. 따로 맞추면 전후를 견줄 수 없다.
  const box: [[number, number], [number, number]] = [
    [6, 6],
    [WIDTH - 6, HEIGHT - 6],
  ];
  const zoomed = !nationwide && focus.length > 0;
  const projection = geoMercator().fitExtent(
    box,
    {
      type: "FeatureCollection",
      features: zoomed ? focus : [...nowIn, ...prevIn],
    } as FeatureCollection,
  );

  /*
   * 바깥으로 물린다.
   *
   * 바뀐 곳에 딱 맞추면 그 도형이 판을 꽉 채워 어디인지 알 수가 없다. 축척을
   * 절반으로 줄이되 판 한가운데를 붙박아 두면, 바뀐 곳이 가운데 절반을 차지하고
   * 나머지 절반이 이웃이 된다.
   *
   * 네모 하나를 지어 거기 맞추는 방법을 먼저 썼는데 지도가 통째로 사라졌다.
   * d3는 위경도 다각형을 구면으로 읽어서, 링을 도는 방향이 반대면 그 네모가
   * 아니라 **네모를 뺀 지구 전체**가 된다.
   */
  if (zoomed) {
    const [[west, south], [east, north]] = geoBounds({
      type: "FeatureCollection",
      features: focus,
    } as FeatureCollection);
    const span = Math.max(east - west, north - south, 1e-6);
    const pad = Math.min(Math.max(PAD, MIN_SPAN / span), 8);

    const [cx, cy] = [WIDTH / 2, HEIGHT / 2];
    const [tx, ty] = projection.translate();
    projection.scale(projection.scale() / pad);
    projection.translate([cx + (tx - cx) / pad, cy + (ty - cy) / pad]);
  }
  const path = geoPath(projection).digits(1);

  /*
   * 짚은 곳에는 이름을 적는다.
   *
   * 도형만으로는 어느 것이 청원군인지 알 수 없어, 표의 줄에 손을 얹기 전에는
   * 지도가 아무 말도 안 했다. 다만 여럿이 겹치면 글자가 서로를 덮으므로
   * 몇 곳 안 될 때만 붙인다 — 도농통합처럼 전국이 물든 판은 세는 그림이지
   * 읽는 그림이 아니다.
   */
  const LABEL_LIMIT = 8;

  /**
   * 지도에 적을 짧은 이름.
   *
   * 판이 청주 하나에 맞춰져 있는데 `청주시흥덕구`라고 적으면 글자가 도형보다
   * 길다. 앞의 시 이름을 뗀다 — 이 판에서 그건 이미 아는 것이다.
   */
  const shortName = (n: string) => n.replace(/^.+?시(?=.{2,}구$)/, "");

  const shape = (f: Feature<Geometry>, named = false): Shape => {
    const at = named ? projection(inside(f)) : null;
    return {
      code: codeOf(f),
      name: nameOf(f),
      d: path(f) ?? "",
      ...(at
        ? {
            at: [Math.round(at[0]), Math.round(at[1])] as [number, number],
            label: shortName(nameOf(f)),
          }
        : {}),
    };
  };

  /**
   * 겹치는 이름은 하나만 남긴다.
   *
   * 상당구와 흥덕구는 붙어 있어 두 이름이 서로를 덮었다. 겹치면 큰 도형 쪽을
   * 남긴다 — 작은 쪽은 어차피 글자가 도형 밖으로 비어져 나온다.
   */
  const place = (regions: Shape[]): Shape[] => {
    const boxes: [number, number, number, number][] = [];
    const order = [...regions]
      .filter((r) => r.at)
      .sort((a, b) => b.d.length - a.d.length);
    const dropped = new Set<Shape>();
    for (const r of order) {
      const [x, y] = r.at!;
      const [w, h] = [(r.label ?? "").length * 7.5, 15];
      const box: [number, number, number, number] = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (boxes.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) {
        dropped.add(r);
        continue;
      }
      boxes.push(box);
    }
    for (const r of dropped) {
      delete r.at;
      delete r.label;
    }
    return regions;
  };

  /*
   * 손으로 적은 날짜가 있으면 그것이 이 사건의 문장이다.
   *
   * 도형에서 뽑은 문장은 무엇이 달라졌는지는 정확하지만(`창원시 사라짐`)
   * 그것이 통합인지 분리인지, 승격인지 편입인지 말해 주지 못한다.
   */
  const known = [
    ...(SIDO_EVENT_BY_YEAR.get(year)?.dates ?? []),
    ...(SIGUNGU_EVENT_BY_YEAR.get(year)?.dates ?? []),
  ]
    .sort((a, b) => a.on.localeCompare(b.on))
    /*
     * 같은 사건이 두 층에 적혀 있으면 한 줄로 남긴다.
     *
     * 세종 출범은 시도 목록에도 시군구 목록에도 있다 — 시도 쪽은
     * `충청남도 연기군 → 세종특별자치시`, 시군구 쪽은 `연기군 → 세종특별자치시`.
     * 같은 날 같은 결과이므로 한 사건이고, 어느 도에서 나왔는지까지 적힌
     * 쪽을 남긴다.
     */
    .filter((d, i, all) => {
      const same = all.filter((x) => x.on === d.on && (x.to ?? []).join() === (d.to ?? []).join());
      if (same.length < 2) return true;
      const best = same.reduce((a, b) =>
        (b.from ?? []).join().length > (a.from ?? []).join().length ? b : a,
      );
      return all.indexOf(best) === i;
    });

  /*
   * 무엇이 무엇으로 바뀌었는지를 **짝으로** 만든다.
   *
   * `화성시 생김 · 화성군 사라짐`은 두 사건처럼 읽히지만 실은 하나다 —
   * 화성군이 화성시로 승격한 것이다. 접미사를 뗀 이름이 같고 같은 시도에
   * 있으면 같은 곳으로 보고 한 줄에 담는다.
   *
   * 짝이 없는 것은 한쪽만 채운 줄로 남는다. 통합처럼 여럿이 하나가 되는
   * 사건은 이 규칙으로 못 잡으므로, 그런 것이야말로 손으로 적을 자리다.
   */
  const goneList = prev.filter((f) => goneSet.has(codeOf(f)));
  const bornList = now.filter((f) => bornSet.has(codeOf(f)));

  /** 그 도형이 속한 시도의 이름. 사건 층이 시군구일 때만 쓸모가 있다. */
  const sidoName = (pool: Feature<Geometry>[], code: string): string => {
    const head = code.slice(0, 2);
    const hit = pool.find((f) => codeOf(f).slice(0, 2) === head && codeOf(f).length <= 2);
    return hit ? nameOf(hit) : SIDO_LABEL[head] ?? "";
  };

  /**
   * 손으로 적은 이름을 도형에 붙인다. 붙지 않으면 지도에서 못 짚을 뿐이다.
   *
   * 공백을 지우고 견준다. 손으로는 `천안시 동남구`라 적고 원본은
   * `천안시동남구`인데, 그 한 칸 때문에 안 붙으면 도형 쪽에서 같은 말을
   * 한 번 더 적는다 — 2008년이 세 줄이었고 그중 둘이 같은 말이었다.
   */
  const locate = (name: string, pool: Feature<Geometry>[]): Named => {
    const flat = name.replace(/\s+/g, "");
    const hit = pool.find((f) => {
      const n = nameOf(f).replace(/\s+/g, "");
      return n === flat || flat.endsWith(n);
    });
    return hit ? { name, code: codeOf(hit) } : { name };
  };

  /*
   * 손으로 적은 것과 도형에서 뽑은 것을 **함께** 쓴다.
   *
   * 손으로 적은 것이 있으면 그것만 쓰고 있었는데, 1995년이 그 때문에 한
   * 줄이 됐다 — 직할시가 광역시로 바뀐 것만 적어 두었고 정작 그해의 큰
   * 사건인 도농통합(시군구 쉰여덟 곳이 합쳐졌다)이 통째로 빠졌다.
   *
   * 손으로 적은 줄이 이미 짚은 도형은 도형 쪽에서 다시 뽑지 않는다.
   */
  const curated: Change[] = known.map((d) => ({
    on: d.on.replace(/-/g, "."),
    from: (d.from ?? []).map((n) => locate(n, prevIn)),
    to: (d.to ?? []).map((n) => locate(n, nowIn)),
  }));
  const spoken = new Set(
    curated.flatMap((c) => [...c.from, ...c.to].map((x) => x.code).filter(Boolean) as string[]),
  );

  let changes: Change[];
  {
    /*
     * 사라진 곳이 **어디로 들어갔는지**를 도형으로 찾는다.
     *
     * 이름으로는 못 잡는다 — 명주군은 강릉시로 들어갔는데 이름이 하나도
     * 안 겹친다. 사라진 곳의 한가운데가 그 뒤 어느 도형 안에 있는지를 보면
     * 그것이 흡수한 곳이다. 도농통합처럼 이름이 남지 않는 사건은 이 방법이
     * 아니면 `사라짐`으로만 적힌다.
     */
    /*
     * **접두사만 떨어진 곳은 이름으로 먼저 짝짓는다.**
     *
     * 광주가 직할시가 되면서 `광주시서구`는 `서구`가 됐다. 그런데 도형으로만
     * 찾으면 옛 서구의 한가운데가 새 광산구 안에 들어가 `광주시서구, 광산군
     * → 광산구` 한 줄이 된다 — 승격은 경계도 함께 손보므로 중심점이 이웃으로
     * 넘어간다. 이럴 때는 이름 쪽이 더 강한 증거다.
     *
     * **뒤에서 잘라 붙는 경우만** 본다. `평택군`은 `평택시`로 끝나지 않으므로
     * 이 규칙에 안 걸리고, 그래야 `송탄시, 평택군 → 평택시` 한 줄이 안 쪼개진다.
     *
     * 같은 이름이 여러 곳에 생겼으면(1990년에 서구가 광주·대전·인천에 다
     * 생겼다) 그중에서 도형으로 가른다. 안에 안 들어가면 가장 가까운 것 —
     * 경계가 크게 조정된 개편에서는 중심점이 이웃으로 넘어가지만, 그래도
     * 대전이나 인천보다는 제 도시 쪽이 가깝다.
     */
    const bare = (f: Feature<Geometry>) => nameOf(f).replace(/\s+/g, "");

    /*
     * **한 도시가 여러 구로 나뉜 것은 한 줄이다.**
     *
     * 수원시에 장안구와 권선구가 생긴 해를 도형으로만 읽으면 `수원시 →
     * 수원시장안구` 한 줄에 `권선구 생김` 한 줄이 따로 붙는다. 흡수는 여럿을
     * 하나로 모으는 규칙이라 하나가 여럿이 되는 쪽을 못 잡는다.
     *
     * 새 이름이 옛 이름으로 **시작하면** 그 도시가 나뉜 것이다. 안양시,
     * 성남시, 청주시, 전주시, 마산시, 고양시, 안산시, 천안시, 용인시,
     * 창원시, 부천시가 모두 이 꼴이다.
     */
    const split = new Map<Feature<Geometry>, Feature<Geometry>[]>();
    {
      const taken = new Set<Feature<Geometry>>();
      for (const g of goneList) {
        const head = bare(g);
        const kids = bornList.filter(
          (b) => !taken.has(b) && bare(b).length > head.length && bare(b).startsWith(head),
        );
        if (kids.length === 0) continue;
        split.set(g, kids);
        for (const k of kids) taken.add(k);
      }
    }
    const byName = (g: Feature<Geometry>): Feature<Geometry> | undefined => {
      const long = bare(g);
      const cands = bornList.filter((b) => bare(b).length < long.length && long.endsWith(bare(b)));
      if (cands.length === 1) return cands[0];
      if (cands.length === 0) return undefined;
      const at = inside(g);
      return (
        cands.find((f) => geoContains(f as Parameters<typeof geoContains>[0], at)) ??
        cands.reduce((a, b) => (geoDistance(inside(b), at) < geoDistance(inside(a), at) ? b : a))
      );
    };

    const absorbed = new Map<string, Feature<Geometry>[]>();
    const orphans: Feature<Geometry>[] = [];
    for (const g of goneList) {
      if (split.has(g)) continue;
      const at = inside(g);
      const host =
        byName(g) ?? now.find((f) => geoContains(f as Parameters<typeof geoContains>[0], at));
      if (!host) {
        orphans.push(g);
        continue;
      }
      const key = codeOf(host);
      absorbed.set(key, [...(absorbed.get(key) ?? []), g]);
    }

    const swallowed = new Set([...absorbed.values()].flat());
    const claimed = new Set([...split.values()].flat());

    const splits: Change[] = [...split].map(([g, kids]) => ({
      from: [{ name: nameOf(g), code: codeOf(g) }],
      to: kids.map((k) => ({ name: nameOf(k), code: codeOf(k) })),
    }));

    /*
     * 흡수한 쪽이 그 해에 새로 생긴 곳이면 통합이고(청원군 → 통합 청주시),
     * 원래 있던 곳이면 편입이다(명주군 → 강릉시). 표에서는 둘 다 같은
     * `A → B` 한 줄이라 가르지 않는다.
     */
    /*
     * **삼킨 자리에서 새로 생긴 곳도 그 줄에 담는다.**
     *
     * 제천군은 1980년에 제천시와 제원군이 됐는데, 흡수는 여럿을 하나로 모으는
     * 규칙이라 `제천군 → 제천시` 한 줄에 `제원군 생김`이 따로 붙었다. 이름이
     * 안 겹치니 접두사 규칙으로도 못 잡는다. 창원군(창원시·의창군), 인천
     * 북구(부평구·계양구)가 모두 같은 꼴이다.
     *
     * 새로 생긴 곳의 안쪽 점이 **사라진 곳의 옛 땅** 안에 있으면 거기서
     * 갈라져 나온 것이다. 이미 다른 줄이 짚은 곳은 건드리지 않는다 —
     * 유성구는 대전시유성출장소가 이미 데려갔다.
     */
    const hosts = new Set([...absorbed.keys()]);
    const spare = bornList.filter((b) => !hosts.has(codeOf(b)) && !claimed.has(b));
    const extra = new Map<string, Feature<Geometry>[]>();
    for (const b of spare) {
      const at = inside(b);
      for (const [hostCode, eaten] of absorbed) {
        if (!eaten.some((g) => geoContains(g as Parameters<typeof geoContains>[0], at))) continue;
        extra.set(hostCode, [...(extra.get(hostCode) ?? []), b]);
        claimed.add(b);
        break;
      }
    }

    const merges: Change[] = [...absorbed].map(([hostCode, eaten]) => {
      const host = now.find((f) => codeOf(f) === hostCode)!;
      /*
       * 이름이 그대로면 무엇이 달라졌는지 안 보인다.
       *
       * 강화군은 1995년에 경기도에서 인천으로 옮겼는데, 이름이 같아서
       * `강화군 → 강화군`으로 적힌다. 그럴 때만 어느 시도의 것인지를 붙인다.
       */
      const same = eaten.length === 1 && nameOf(eaten[0]) === nameOf(host);
      const label = (f: Feature<Geometry>, side: Feature<Geometry>[]) =>
        same ? `${sidoName(side, codeOf(f))} ${nameOf(f)}`.trim() : nameOf(f);
      return {
        from: eaten.map((f) => ({ name: label(f, prev), code: codeOf(f) })),
        to: [
          { name: label(host, now), code: hostCode },
          ...(extra.get(hostCode) ?? []).map((f) => ({ name: nameOf(f), code: codeOf(f) })),
        ],
      };
    });

    /*
     * 손으로 적은 줄이 이미 말한 곳은 도형 쪽에서 다시 적지 않는다.
     *
     * 양쪽 이름이 다 짚혔을 때만 걸렀더니, 손으로 `연기군 → 세종특별자치시`라
     * 적어 두고도 도형 쪽에서 `연기군 → 세종시`가 한 줄 더 나왔다 — 원본의
     * 이름은 `세종시`라 오른쪽이 안 붙는다. **어디가 달라졌는가**는 왼쪽이
     * 정하므로 왼쪽만 본다.
     */
    const untold = (c: Change) => !c.from.every((x) => x.code && spoken.has(x.code));

    const leftBorn = bornList.filter((b) => !absorbed.has(codeOf(b)) && !claimed.has(b));

    changes = [
      ...curated,
      ...splits.filter(untold),
      ...merges.filter(untold),
      ...leftBorn
        .filter((f) => !spoken.has(codeOf(f)))
        .map((f) => ({ from: [], to: [{ name: nameOf(f), code: codeOf(f) }] })),
      ...orphans
        .filter((f) => !swallowed.has(f) && !split.has(f) && !spoken.has(codeOf(f)))
        .map((f) => ({ from: [{ name: nameOf(f), code: codeOf(f) }], to: [] })),
    ];
  }

  /** 제목·설명용 한 줄. 화면은 위의 짝을 쓴다. */
  const headline = changes
    .map((c) =>
      c.from.length && c.to.length
        ? `${c.from.map((x) => x.name).join(", ")} → ${c.to.map((x) => x.name).join(", ")}`
        : c.to.length
          ? `${c.to.map((x) => x.name).join(", ")} 생김`
          : `${c.from.map((x) => x.name).join(", ")} 사라짐`,
    )
    .join(", ");

  const atYears = [...new Set(known.map((d) => d.on.slice(0, 4)))];

  /*
   * 상태를 만든다.
   *
   * 보통은 앞뒤 둘이다. 한 판에 사건이 여럿이고 그중 **경계는 그대로고
   * 이름만 바뀐 것**이 있으면 그 사이 상태를 지어낼 수 있다 — 당진군이
   * 당진시가 된 것은 땅이 달라진 게 아니라, 앞 판의 도형에 이름만 갈아
   * 끼우면 그 시점의 지도가 된다.
   */
  /*
   * **짚는 곳은 표가 정한다.**
   *
   * 원본 diff만 보면 2014년 뒤 지도에 새로 생긴 서원구와 청원구만 물든다.
   * 상당구와 흥덕구는 이름이 그대로라 diff에 안 잡히기 때문이다. 그런데 그해
   * 사건은 `청주시, 청원군 → 네 개 구`이고, 그 넷이 다 물들어야 그 문장이다.
   *
   * 앞 시점은 표의 왼쪽, 뒤 시점은 표의 오른쪽이다.
   */
  const sideCodes = (pick: (c: Change) => Named[], pool: Feature<Geometry>[]) => {
    const want = new Set<string>();
    for (const c of changes) {
      for (const x of pick(c)) {
        if (x.code) {
          want.add(x.code);
          continue;
        }
        /*
         * 이름이 도형 하나에 안 붙으면 **여러 도형일 수 있다.**
         *
         * 2013년에는 `청주시`라는 도형이 없다. 그 도시는 상당구와 흥덕구
         * 둘로 그려져 있다. 그래서 `청주시, 청원군 → 네 개 구`라 적어 두고도
         * 앞 지도에서는 청원군만 물들고 가운데 구멍은 회색이었다.
         */
        const head = x.name.replace(/\s+/g, "");
        for (const f of pool) {
          if (nameOf(f).replace(/\s+/g, "").startsWith(head)) want.add(codeOf(f));
        }
      }
    }
    return pool.filter((f) => want.has(codeOf(f))).map(codeOf);
  };
  const goneCodes = new Set(sideCodes((c) => c.from, prevIn));
  const bornCodes = new Set(sideCodes((c) => c.to, nowIn));

  const states: Side[] = [
    {
      year: prevYear,
      regions: place(
        prevIn.map((f) => shape(f, goneCodes.has(codeOf(f)) && goneCodes.size <= LABEL_LIMIT)),
      ),
      marked: [...goneCodes],
      tone: "gone",
    },
  ];

  const renaming = known.filter((d) => d.renames?.length);
  for (const d of renaming) {
    const byCode = new Map(d.renames!.map((r) => [r.code, r.to]));
    states.push({
      year: d.on.slice(0, 7).replace("-", "."),
      regions: prevIn.map((f) => {
        const to = byCode.get(codeOf(f));
        return to ? { ...shape(f), name: to } : shape(f);
      }),
      marked: [...byCode.keys()],
      tone: "born",
    });
  }

  states.push({
    year,
    regions: place(
      nowIn.map((f) => shape(f, bornCodes.has(codeOf(f)) && bornCodes.size <= LABEL_LIMIT)),
    ),
    /*
     * 앞에서 이미 짚은 곳은 여기서 다시 짚지 않는다. 당진시는 1월에 생겼으니
     * 7월 지도에서 새것으로 보일 이유가 없다.
     */
    marked: nowIn
      .filter((f) => bornCodes.has(codeOf(f)))
      .filter((f) => !renaming.some((d) => d.renames!.some((r) => r.to === nameOf(f))))
      .map(codeOf),
    tone: "born",
  });

  /*
   * 목록용 요약은 **여기서** 챙긴다.
   *
   * 아래에서 같은 날짜의 사건을 하나로 합치는데, 그때 지도 한 장이 버려진다.
   * 그래도 그 해에 무엇이 무엇으로 바뀌었는지는 목록에 남아야 한다 —
   * `/history`의 줄은 원본 자료의 해마다 하나씩이기 때문이다.
   */
  summaries[year] = changes.map((c) => ({
    /* 손으로 적어 둔 줄인지 가른다. 목록이 그 줄을 앞에 세운다. */
    ...(c.on ? { dated: true } : {}),
    from: c.from.map((x) => x.name),
    to: c.to.map((x) => x.name),
  }));

  events.push({
    year,
    at: atYears.length === 0 ? year : atYears.length === 1 ? atYears[0] : `${atYears[0]}–${atYears.at(-1)}`,
    width: WIDTH,
    height: HEIGHT,
    nationwide,
    dated: known.length > 0,
    changes,
    headline,
    states,
  });
  process.stdout.write(`  ${prevYear}→${year} · ${level} · ${nowIn.length}곳\n`);
}

/*
 * 읍면동 층에서만 보이는 사건.
 *
 * 시군구 층만 훑으면 2019년은 아무 일도 없는 해다. 부천이 동 서른여섯 개를
 * 열 개로 묶은 그해가 연표에 아예 없다. 손으로 적어 둔 것만 굽는다 —
 * 이 층에서 나올 이야기가 그것 하나임을 전국을 훑어 확인했다.
 */
for (const spec of DONG_EVENTS) {
  const sides: Feature<Geometry>[][] = [];
  for (const y of spec.states) {
    const file = fileOf(y);
    if (!file) break;
    const all = await read(y, "dong", file);
    sides.push(all.filter((f) => prop(f.properties, "_cd").startsWith(spec.prefix)));
  }
  if (sides.length !== spec.states.length) {
    process.stdout.write(`  ${spec.key} 읍면동 원본이 모자람 — 건너뜀\n`);
    continue;
  }

  // 투영은 모든 시점이 함께 쓴다. 조각 수가 달라져도 도시는 제자리에 있어야 한다.
  const projection = geoMercator().fitExtent(
    [
      [6, 6],
      [LOCAL.width - 6, LOCAL.height - 6],
    ],
    { type: "FeatureCollection", features: sides.flat() } as FeatureCollection,
  );
  const path = geoPath(projection).digits(1);

  events.push({
    year: spec.key,
    at: spec.at,
    width: LOCAL.width,
    height: LOCAL.height,
    nationwide: false,
    dated: true,
    changes: spec.changes.map((c) => ({
      on: c.on?.replace(/-/g, "."),
      from: c.from.map((name) => ({ name })),
      to: c.to.map((name) => ({ name })),
    })),
    headline: spec.changes.map((c) => `${c.from.join(", ")} → ${c.to.join(", ")}`).join(", "),
    /*
     * 짚지 않는다. 도시가 통째로 다시 나뉜 사건이라 전부 칠하면 지도가
     * 한 덩어리 색이 된다. 조각 수가 달라지는 것 자체가 이 사건이다.
     */
    states: sides.map((features, i) => ({
      year: spec.states[i],
      regions: features.map((f) => ({
        code: prop(f.properties, "_cd"),
        name: prop(f.properties, "_nm"),
        d: path(f) ?? "",
      })),
      marked: [],
      tone: "born" as const,
    })),
  });
  process.stdout.write(
    `  ${spec.key} 읍면동 · ${sides.map((s, i) => `${spec.states[i]} ${s.length}곳`).join(" → ")}\n`,
  );
}

/*
 * 실제 날짜가 같은 사건은 하나로 합친다.
 *
 * 제주는 자료에서 둘로 갈라져 기록됐다 — 시군구(북제주군·남제주군 폐지)는
 * 2006년 판에, 시도(제주특별자치도)는 2007년 판에. 실제로는 2006년 7월 1일
 * 하루에 일어난 한 사건이라, 그대로 두면 화면에 `2006`이 두 번 뜬다.
 *
 * 지도는 시군구 쪽을 남긴다. 같은 사건을 더 잘게 보여 주는 그림이다.
 */
const merged: Event[] = [];
for (const e of events) {
  const twin = e.dated ? merged.find((m) => m.dated && m.at === e.at) : undefined;
  if (!twin) {
    merged.push(e);
    continue;
  }
  const parts = [...new Set([...twin.headline.split(" · "), ...e.headline.split(" · ")])];
  twin.headline = parts.sort().join(" · ");
  process.stdout.write(`  ${e.at} 두 기록을 합침 (/${twin.year}에 남김)\n`);
}
events.length = 0;
events.push(...merged);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  `${JSON.stringify({
    _source: "통계청 SGIS 센서스용 행정구역경계",
    _note:
      "개편 사건마다 전후를 굽는다. 판 크기는 사건마다 다르다 — 전국에 걸친 것은 나라 전체를 담는다. npm run build:events.",
    events,
  })}\n`,
);

/*
 * 어느 해에 지도가 있는지만 따로 낸다.
 *
 * `/history`는 목록에 링크를 걸지 말지만 알면 되는데, 그것 때문에 사건
 * 전체(수 MB)를 가져오면 그 페이지가 통째로 무거워진다.
 */
await writeFile(
  join(dirname(OUT), "event-years.json"),
  `${JSON.stringify(events.map((e) => e.year))}\n`,
);

/*
 * 목록에 적을 짝.
 *
 * `/history`가 원본의 born·gone을 그대로 늘어놓고 있었다. 그러면 1995년이
 * 이름 예순 개의 벽이 되고, `나주군 사라짐`처럼 절반만 참인 말이 된다 —
 * 나주시와 나주군이 합쳐져 나주시가 된 것이다. 그 짝은 여기서만 알 수 있다.
 */
await writeFile(
  join(dirname(OUT), "event-summaries.json"),
  `${JSON.stringify(summaries)}\n`,
);

process.stdout.write(
  `\n사건 ${events.length}개 · ${Math.round(JSON.stringify(events).length / 1024)}KB\n${OUT}\n`,
);

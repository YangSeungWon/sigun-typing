/**
 * 시군구마다 읍면동 코스를 만든다.  실행: `npm run build:dong`
 *
 * 손으로 쓰지 않는 유일한 코스 파일이다. 시군구가 252개이고 읍면동이
 * 3,559곳이라 사람이 쓸 분량이 아니다.
 *
 * **관건은 순서다.** 이 게임은 가나다순을 금지한다 — "순서가 이 게임의
 * 전부다. 지리적으로 인접한 지역을 잇는 경로여야 한다"(data/types.ts).
 * 중심점이 가까운 것끼리 이으면 강을 건너뛰고 산을 넘는 길이 나오므로,
 * TopoJSON이 아는 **맞닿음**(공유 arc) 위를 걷는다.
 *
 * 손으로 쓴 코스가 이미 있는 시군구는 건드리지 않는다. 자기 나와바리를
 * 정성껏 짜 두었으면 그것이 이긴다.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoCentroid } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { feature, neighbors } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Course } from "../data/types.ts";
import { romanize } from "../lib/hangul/romanize.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "data/geo/source");
const COURSE_DIR = join(ROOT, "data/courses");

/** 원본에서 코드·이름을 꺼낸다. 필드 이름이 층마다 다르다. */
function prop(props: Record<string, unknown> | null | undefined, suffix: string): string {
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.toLowerCase().endsWith(suffix)) return String(v);
  }
  return "";
}

/**
 * 표준 표기.
 *
 * 가운뎃점은 한글 자판에 없어 따라치기와 정답 베껴 쓰기에서 칠 수가 없다.
 * 그래서 표준은 점을 뺀 숫자꼴로 두고 공식 표기를 별칭으로 받는다 —
 * `place.ts`가 세운 "지도에 적힌 이름을 그대로 친다"의 유일한 예외이고,
 * 이유는 편의가 아니라 칠 수 없음이다. 전국에서 서른 곳이 여기 해당한다.
 */
function standardName(official: string): { name: string; aliases: string[] } {
  if (!official.includes("·")) return { name: official, aliases: [] };
  const plain = official.replace(/·/g, "");
  return { name: plain, aliases: [official, official.replace(/·/g, ".")] };
}

/**
 * `수원시 장안구` → `suwon-jangan`. 공백과 중간 단위를 함께 턴다.
 *
 * 긴 접미사를 먼저 턴다 — `세종특별자치시`에서 `시`만 떼면
 * `sejongteukbyeoljachi`가 된다.
 */
function slug(name: string): string {
  return name
    .split(/\s+/)
    .map((part) =>
      romanize(part.replace(/(특별자치시|특별자치도|특별시|광역시|시|군|구)$/, "")).toLowerCase(),
    )
    .filter(Boolean)
    .join("-");
}

interface Node {
  i: number;
  code: string;
  name: string;
  c: [number, number];
  nb: number[];
}

/**
 * 맞닿은 곳을 잇는 경로.
 *
 * 갈 곳을 고를 때 **남은 이웃이 가장 적은 쪽**을 먼저 간다(Warnsdorff).
 * 그냥 가까운 데로 가면 구석에 있는 동을 남겨 두고 지나쳐, 나중에 지도
 * 반대편에서 되돌아와야 한다.
 *
 * 그래도 막히면(섬, 갈라진 구) 남은 것 중 가장 가까운 곳으로 건너뛴다.
 * 건너뛴 횟수를 세어 두었다가 많은 코스를 알려 준다 — 그런 곳은 사람이
 * 손을 봐야 할 후보다.
 */
function route(nodes: Node[]): { order: Node[]; jumps: number } {
  const dist = (a: Node, b: Node) => Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]);
  // 출발은 가장 서쪽. 기존 코스들이 대체로 서에서 동으로 걷는다.
  const start = nodes.reduce((a, b) => (b.c[0] < a.c[0] ? b : a));

  const seen = new Set([start.i]);
  const order = [start];
  let cur = start;
  let jumps = 0;

  while (order.length < nodes.length) {
    const byIndex = new Map(nodes.map((n) => [n.i, n]));
    const open = cur.nb.filter((j) => !seen.has(j) && byIndex.has(j));
    let next: Node;
    if (open.length > 0) {
      const openCount = (k: number) =>
        (byIndex.get(k)?.nb ?? []).filter((m) => !seen.has(m) && byIndex.has(m)).length;
      next = byIndex.get(open.reduce((best, j) => (openCount(j) < openCount(best) ? j : best)))!;
    } else {
      const rest = nodes.filter((n) => !seen.has(n.i));
      next = rest.reduce((a, b) => (dist(cur, b) < dist(cur, a) ? b : a));
      jumps++;
    }
    seen.add(next.i);
    order.push(next);
    cur = next;
  }
  return { order, jumps };
}

const dongFile = join(SOURCE_DIR, "korea-dong.json");
if (!existsSync(dongFile)) {
  throw new Error(
    `${dongFile}이 없다.\n` +
      "`npm run build:geo`를 한 번 돌리면 SGIS 원본에서 만들어진다.\n" +
      "(그 원본은 sgis.mods.go.kr에서 신청해 data/geo/source/sgis/에 두어야 한다)",
  );
}

const dongTopo = JSON.parse(await readFile(dongFile, "utf8")) as Topology;
const dongKey = Object.keys(dongTopo.objects)[0];
const allDong = (dongTopo.objects[dongKey] as GeometryCollection).geometries;

const sigunguTopo = JSON.parse(
  await readFile(join(SOURCE_DIR, "korea-sigungu.json"), "utf8"),
) as Topology;
const sgKey = Object.keys(sigunguTopo.objects)[0];
const sigungu = (sigunguTopo.objects[sgKey] as GeometryCollection).geometries
  .map((g) => ({ code: prop(g.properties, "_cd"), name: prop(g.properties, "_nm") }))
  .filter((s) => s.code && s.name)
  .sort((a, b) => a.code.localeCompare(b.code));

/*
 * 시도 접두사 → 그 시도의 코스 id와 권역.
 *
 * 새로 적어 두지 않는다. 시군구 코스마다 원본 접두사(geo.prefix)와 권역이
 * 이미 있으므로 여기서 짝지어 읽기만 하면 된다.
 */
/*
 * 손으로 쓴 코스만 읽는다.
 *
 * `index.ts`를 통째로 가져오면 **자기가 지난번에 만든 것까지 딸려 와서**
 * 전부 "이미 있는 코스"로 보고 아무것도 안 만든다. 생성물은 파일 이름으로
 * 갈린다 — `dong-*.ts`는 이 스크립트가 쓴 것이다.
 */
const handWritten: Course[] = [];
for (const file of await readdir(COURSE_DIR)) {
  if (!file.endsWith(".ts") || file.startsWith("dong-")) continue;
  if (file === "index.ts" || file.endsWith(".test.ts")) continue;
  const mod = await import(join(COURSE_DIR, file));
  for (const v of Object.values(mod)) {
    if (v && typeof v === "object" && "id" in v && "regions" in v) handWritten.push(v as Course);
  }
}

const sidoInfo = new Map<string, { id: string; group: string; name: string }>();
for (const c of handWritten) {
  if (c.level !== "sigungu" || !c.geo?.prefix) continue;
  sidoInfo.set(c.geo.prefix, {
    id: c.id,
    group: c.group,
    name: c.parentName ?? c.name,
  });
}

/*
 * 세종만 위 방법으로 못 얻는다 — **시도이면서 그 아래 시군구가 없어서**
 * 시군구 코스 자체가 없다(`lib/home/summary.ts`도 같은 이유로 세종 줄을
 * 비워 둔다). 그래도 읍면동은 있으므로 여기서만 손으로 적는다.
 */
if (!sidoInfo.has("29")) {
  sidoInfo.set("29", { id: "sejong", group: "chungcheong", name: "세종특별자치시" });
}

/** 이미 손으로 쓴 코스가 있는 시군구는 건너뛴다. */
const handMade = new Set(
  handWritten.filter((c) => c.level === "dong" && c.geo?.prefix).map((c) => c.geo!.prefix!),
);

const bySido = new Map<string, string[]>();
const report: { id: string; name: string; count: number; jumps: number }[] = [];
let skipped = 0;

for (const sg of sigungu) {
  if (handMade.has(sg.code)) {
    skipped++;
    continue;
  }
  const sido = sidoInfo.get(sg.code.slice(0, 2));
  if (!sido) {
    process.stdout.write(`  ${sg.name}(${sg.code}) 시도 정보 없음 — 건너뜀\n`);
    continue;
  }

  const picked = allDong.filter((g) => prop(g.properties, "_cd").startsWith(sg.code));
  if (picked.length === 0) {
    process.stdout.write(`  ${sg.name}(${sg.code}) 읍면동 없음 — 건너뜀\n`);
    continue;
  }

  const sub = { type: "GeometryCollection" as const, geometries: picked };
  const fc = feature(dongTopo, sub) as FeatureCollection;
  const adj = neighbors(picked);
  const nodes: Node[] = picked.map((g, i) => ({
    i,
    code: prop(g.properties, "_cd"),
    name: prop(g.properties, "_nm"),
    c: geoCentroid(fc.features[i] as Feature) as [number, number],
    nb: adj[i],
  }));

  const { order, jumps } = route(nodes);

  // 이름이 전부 동으로 끝나면 `동`, 읍이나 면이 섞이면 `읍면동`.
  const unit = order.every((n) => n.name.endsWith("동")) ? "동" : "읍면동";
  /*
   * 보통은 `시도-시군구`다(서울 중구와 부산 중구를 가르려면 시도가 있어야 한다).
   *
   * 시군구가 하나뿐인 시도만 예외로 이름을 한 번만 적는다 — 세종이 그렇다.
   * 이름이 같은지로 판단하면 안 된다. 제주도의 코스 id가 `jeju`이고 제주시의
   * 이름도 `jeju`라 제주시가 제주도 코스와 부딪친다.
   */
  const own = slug(sg.name);
  const alone = sigungu.filter((s) => s.code.slice(0, 2) === sg.code.slice(0, 2)).length === 1;
  const id = alone ? own : `${sido.id}-${own}`;

  const regions = order.map((n) => {
    const { name, aliases } = standardName(n.name);
    const alias = aliases.length > 0 ? `, aliases: ${JSON.stringify(aliases)}` : "";
    return `    { code: "${n.code}", name: "${name}"${alias} },`;
  });

  const body = `  {
    id: "${id}",
    name: "${sg.name} ${order.length}개 ${unit}",
    group: "${sido.group}",
    level: "dong",
    parentName: "${sido.name} ${sg.name}",
    placeUnit: "${unit}",
    version: 1,
    description: "${standardName(order[0].name).name}에서 ${standardName(order.at(-1)!.name).name}까지",
    geo: { file: "dong", prefix: "${sg.code}" },
    regions: [
${regions.join("\n")}
    ],
  },`;

  const key = sido.id;
  if (!bySido.has(key)) bySido.set(key, []);
  bySido.get(key)!.push(body);
  report.push({ id, name: sg.name, count: order.length, jumps });
}

await mkdir(COURSE_DIR, { recursive: true });
const written: string[] = [];
for (const [sidoId, bodies] of bySido) {
  const file = join(COURSE_DIR, `dong-${sidoId}.ts`);
  await writeFile(
    file,
    `import type { Course } from "../types";

/*
 * 자동 생성 — 손대지 마세요. \`npm run build:dong\`이 다시 씁니다.
 *
 * 순서는 맞닿은 읍면동을 잇는 경로다(scripts/build-dong-courses.mts).
 * 어느 한 곳을 정성껏 손보고 싶으면 이 파일에서 떼어 자기 파일로 옮기세요 —
 * 생성기는 이미 코스가 있는 시군구를 건너뜁니다.
 */
export const dong_${sidoId.replace(/-/g, "_")}: Course[] = [
${bodies.join("\n")}
];
`,
  );
  written.push(`dong-${sidoId}.ts`);
}

/*
 * 지도 로더도 함께 쓴다.
 *
 * `lib/geo.ts`는 코스마다 한 줄씩 손으로 적는 목록이다 — 빠뜨리면 지도 없이
 * 조용히 돌아가므로 일부러 그렇게 두었고, 검사가 대조해 준다. 다만 251개는
 * 손으로 적을 분량이 아니라서 이 파일만 생성한다. 동적 import 경로는 번들러가
 * 정적으로 읽어야 하므로 문자열을 그대로 박는다.
 */
await writeFile(
  join(ROOT, "lib/geo.dong.ts"),
  `/*
 * 자동 생성 — 손대지 마세요. \`npm run build:dong\`이 다시 씁니다.
 * 읍면동 코스의 지도 로더입니다. lib/geo.ts가 이것을 펼쳐 씁니다.
 */
export const DONG_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
${report.map((r) => `  "${r.id}": () => import("@/data/geo/${r.id}.json"),`).join("\n")}
};
`,
);

// 오래된 생성 파일이 남아 있으면 코스가 유령처럼 살아난다.
for (const f of await readdir(COURSE_DIR)) {
  if (f.startsWith("dong-") && f.endsWith(".ts") && !written.includes(f)) {
    process.stdout.write(`  낡은 파일 ${f} — 지우세요\n`);
  }
}

const total = report.reduce((s, r) => s + r.count, 0);
const rough = report.filter((r) => r.jumps > 1).sort((a, b) => b.jumps - a.jumps);
process.stdout.write(
  `\n코스 ${report.length}개 · 읍면동 ${total}곳 · 파일 ${written.length}개` +
    (skipped > 0 ? ` · 손으로 쓴 것 ${skipped}개 건너뜀` : "") +
    "\n",
);
if (rough.length > 0) {
  process.stdout.write(`\n건너뛴 자리가 많은 코스 — 손볼 후보 ${rough.length}개\n`);
  for (const r of rough.slice(0, 12)) {
    process.stdout.write(`  ${r.name} ${r.count}곳 · 건너뜀 ${r.jumps}번\n`);
  }
}

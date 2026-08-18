/**
 * 고도 띠를 굽는다.  실행: `npm run build:terrain`
 *
 * 행정구역만 그린 지도는 평평하다. 강을 얹으니 훨씬 읽혔는데, 산이 어디
 * 있는지는 여전히 안 보인다 — 강원도가 왜 그렇게 생겼는지, 서울이 왜 그
 * 자리에 앉았는지는 지형이 말해 준다.
 *
 * **봉우리 점은 안 쓴다.** OSM에 만육천 개가 있지만 점 무더기로는 "여기 산
 * 있음" 이상을 말하지 못하고, 이름을 얹으면 정답이 새어 나간다 — 지역 이름
 * 3,108개 중 638개가 같은 어간의 봉우리를 갖고 있다(도봉구↔도봉산).
 * 지형은 색으로 말해야 한다.
 *
 * 원본은 SRTM 1초(약 30m)다. AWS 공개 자료라 신청도 키도 없고, `.hgt`는
 * 빅엔디언 16비트 정수를 줄줄이 늘어놓은 것뿐이라 읽는 데 아무것도 필요 없다.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEM_DIR = join(ROOT, "data/geo/source/dem");
const BASE = "https://s3.amazonaws.com/elevation-tiles-prod/skadi";

/** 남한이 들어가는 1도 칸. 북위 33~38, 동경 124~131. */
const LAT = [33, 34, 35, 36, 37, 38];
const LON = [124, 125, 126, 127, 128, 129, 130, 131];

/** 한 변의 표본 수. SRTM 1초는 3601이다. */
const SIDE = 3601;

const tileName = (lat: number, lon: number) =>
  `N${String(lat).padStart(2, "0")}E${String(lon).padStart(3, "0")}`;

/** 없으면 받는다. 타일 하나가 13MB고 마흔여덟 칸이다. */
async function ensureTile(lat: number, lon: number): Promise<string | null> {
  const name = tileName(lat, lon);
  const hgt = join(DEM_DIR, `${name}.hgt`);
  if (existsSync(hgt)) return hgt;

  const url = `${BASE}/N${String(lat).padStart(2, "0")}/${name}.hgt.gz`;
  const res = await fetch(url);
  if (!res.ok) return null; // 바다뿐인 칸은 아예 없다

  const gz = join(DEM_DIR, `${name}.hgt.gz`);
  await writeFile(gz, Buffer.from(await res.arrayBuffer()));
  await pipeline(createReadStream(gz), createGunzip(), createWriteStream(hgt));
  process.stdout.write(`  ${name}\n`);
  return hgt;
}

await mkdir(DEM_DIR, { recursive: true });
process.stdout.write("DEM 타일을 받는 중\n");
const tiles = new Map<string, Buffer>();
for (const lat of LAT) {
  for (const lon of LON) {
    const path = await ensureTile(lat, lon);
    if (path) tiles.set(tileName(lat, lon), await readFile(path));
  }
}
process.stdout.write(`타일 ${tiles.size}칸\n`);

/**
 * 한 지점의 고도.
 *
 * `.hgt`는 북서 모서리부터 서쪽→동쪽, 북쪽→남쪽으로 읽는다. 값이 없는 자리는
 * -32768인데 바다로 친다.
 */
function elevationAt(lat: number, lon: number): number {
  const [flat, flon] = [Math.floor(lat), Math.floor(lon)];
  const buf = tiles.get(tileName(flat, flon));
  if (!buf) return 0;
  const row = Math.round((flat + 1 - lat) * (SIDE - 1));
  const col = Math.round((lon - flon) * (SIDE - 1));
  const i = (row * SIDE + col) * 2;
  if (i < 0 || i + 1 >= buf.length) return 0;
  const v = buf.readInt16BE(i);
  return v === -32768 ? 0 : v;
}

await writeFile(
  join(ROOT, "data/geo/source/dem-index.json"),
  `${JSON.stringify([...tiles.keys()])}\n`,
);
process.stdout.write(`\n한 점 확인 — 남한산성 부근 ${elevationAt(37.48, 127.18)}m\n`);

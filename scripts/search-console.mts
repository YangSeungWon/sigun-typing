/*
 * 서치콘솔에서 검색 실적과 색인 상태를 읽어 온다. 실행: `npm run gsc`
 *
 * 서치콘솔 화면으로도 볼 수 있지만 이건 **추이를 파일로 남기려고** 있다.
 * 화면은 지난주 숫자를 오늘 숫자 옆에 놓아 주지 않는다.
 *
 *   GSC_KEY=~/.ssh/gsc-....json npm run gsc
 *   GSC_KEY=... npm run gsc -- --index          # 색인 상태까지 (느리다)
 *   GSC_KEY=... npm run gsc -- --index --log gsc.tsv
 *
 * 열쇠는 저장소에 두지 않는다. 읽기 전용 서비스 계정을 만들어 서치콘솔
 * 속성에 `제한된 사용자`로 추가하고, 그 JSON 경로를 `GSC_KEY`로 넘긴다.
 *
 * `--index`는 sitemap의 주소를 하나씩 URL 검사 API에 묻는다. 한 건에 7초쯤
 * 걸리고 하루 2000건 한도가 있다 — 주소가 900개면 20분이다. 매번 돌릴 것이
 * 아니라 주 1회로 잡는다.
 */
import { createSign } from "node:crypto";
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";

const SITE = process.env.GSC_SITE ?? "sc-domain:sigun-typing.ysw.kr";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};

const keyPath = (process.env.GSC_KEY ?? "").replace(/^~/, homedir());
if (!keyPath || !existsSync(keyPath)) {
  console.error("GSC_KEY에 서비스 계정 JSON 경로를 넘겨야 한다.");
  process.exit(1);
}

type Key = { client_email: string; private_key: string; token_uri: string };
const key: Key = JSON.parse(readFileSync(keyPath, "utf8"));

/* 서비스 계정은 사람 계정처럼 동의 화면을 거치지 않는다. 자기가 서명한
 * JWT를 토큰으로 바꿔 온다. 라이브러리 없이 여기서 끝난다. */
async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${part({ alg: "RS256", typ: "JWT" })}.${part({
    iss: key.client_email, scope: SCOPE, aud: key.token_uri, iat: now, exp: now + 3600,
  })}`;
  const assertion = `${body}.${createSign("RSA-SHA256").update(body).sign(key.private_key, "base64url")}`;
  const res = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion,
    }),
  });
  if (!res.ok) throw new Error(`토큰 실패 ${res.status} ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const token = await accessToken();
const call = async <T,>(url: string, payload: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
};

/* 구글은 최근 며칠치를 나중에 채워 넣는다. 어제까지로 끊으면 주마다 재는
 * 자리가 달라져 추이가 늘 내려가는 것처럼 보인다. 사흘 물러선다. */
const day = (back: number) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
const days = Number(value("--days") ?? 28);
const endDate = day(3);
const startDate = day(3 + days);

type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
const analytics = (dimensions: string[], rowLimit = 10) =>
  call<{ rows?: Row[] }>(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
    { startDate, endDate, dimensions, rowLimit },
  );

console.log(`${SITE}  ${startDate} ~ ${endDate} (${days}일)\n`);

const total = (await analytics([], 1)).rows?.[0];
console.log(total
  ? `클릭 ${total.clicks} · 노출 ${total.impressions} · CTR ${(total.ctr * 100).toFixed(1)}% · 평균 순위 ${total.position.toFixed(1)}`
  : "실적 없음");

const show = async (label: string, dimension: string, n = 10) => {
  const rows = (await analytics([dimension], n)).rows ?? [];
  if (!rows.length) return;
  console.log(`\n[${label}]`);
  for (const r of rows) {
    const name = (r.keys?.[0] ?? "").replace(/^https:\/\/[^/]+/, "") || "/";
    console.log(`  ${name.slice(0, 52).padEnd(52)} 클릭 ${String(r.clicks).padStart(4)} 노출 ${String(r.impressions).padStart(6)} 순위 ${r.position.toFixed(1).padStart(5)}`);
  }
};
await show("검색어", "query", 15);
await show("페이지", "page", 15);
await show("기기", "device");

/*
 * 색인 상태.
 *
 * 여기서 갈리는 것은 "색인 안 됨"의 두 가지 뜻이다. 크롤하고 나서 안 넣은
 * 것이면 페이지 문제고, 아직 안 가져간 것이면 그냥 순서가 안 온 것이다.
 * 앞은 고칠 거리가 있고 뒤는 기다리면 된다 — 표를 그렇게 나눠 찍는다.
 */
type Status = { coverageState?: string; lastCrawlTime?: string; googleCanonical?: string };
let counts: Record<string, number> | undefined;

if (flag("--index")) {
  // 속성은 `sc-domain:example.com`이거나 `https://example.com/`이다.
  const host = SITE.startsWith("sc-domain:") ? `https://${SITE.slice(10)}` : SITE.replace(/\/$/, "");
  const sitemapUrl = value("--sitemap") ?? `${host}/sitemap.xml`;
  const xml = await (await fetch(sitemapUrl)).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log(`\n\nsitemap ${urls.length}개 검사 — 한 건에 7초쯤, 여섯씩 병렬로 돈다`);

  const found = new Map<string, Status>();
  let done = 0;
  const one = async (url: string) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE }),
      });
      if (res.ok) {
        const body = await res.json() as { inspectionResult: { indexStatusResult: Status } };
        found.set(url, body.inspectionResult.indexStatusResult);
        return;
      }
      // 429는 분당 한도다. 하루 한도(2000)에 걸린 것이면 네 번 쉬어도 안 열린다.
      if (res.status !== 429 && res.status < 500) {
        found.set(url, { coverageState: `HTTP ${res.status}` });
        return;
      }
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    found.set(url, { coverageState: "조회 실패" });
  };

  const queue = [...urls];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      await one(url);
      if (++done % 100 === 0) console.log(`  ${done}/${urls.length}`);
    }
  }));

  const section = (url: string) => {
    const parts = new URL(url).pathname.replace(/^\/|\/$/g, "").split("/");
    if (!parts[0]) return "/";
    if (parts[0] === "play") return `/play/${parts[1]}`;
    if (parts[0] === "history") return parts.length > 2 ? "/history/dong" : parts.length > 1 ? "/history/<연도>" : "/history";
    if (parts[0] === "courses") return parts.length > 1 ? "/courses/<코스>" : "/courses";
    return `/${parts.join("/")}`;
  };
  const INDEXED = "Submitted and indexed";
  const DISCOVERED = "Discovered - currently not indexed";
  const table = new Map<string, { all: number; indexed: number; discovered: number; unknown: number }>();
  counts = { 전체: urls.length, 색인: 0, 발견만: 0, 모름: 0, 크롤됐는데_색인안됨: 0 };
  for (const [url, s] of found) {
    const k = section(url);
    const row = table.get(k) ?? { all: 0, indexed: 0, discovered: 0, unknown: 0 };
    row.all++;
    if (s.coverageState === INDEXED) { row.indexed++; counts.색인++; }
    else if (s.coverageState === DISCOVERED) { row.discovered++; counts.발견만++; }
    else { row.unknown++; counts.모름++; }
    if (s.lastCrawlTime && s.coverageState !== INDEXED) counts.크롤됐는데_색인안됨++;
    table.set(k, row);
  }

  console.log(`\n${"구간".padEnd(20)}${"전체".padStart(5)}${"색인".padStart(6)}${"발견만".padStart(7)}${"그밖".padStart(6)}`);
  for (const [k, r] of [...table].sort((a, b) => b[1].all - a[1].all)) {
    console.log(`${k.padEnd(20)}${String(r.all).padStart(5)}${String(r.indexed).padStart(6)}${String(r.discovered).padStart(7)}${String(r.unknown).padStart(6)}`);
  }

  const stuck = counts.크롤됐는데_색인안됨;
  console.log(stuck
    ? `\n크롤하고도 색인 안 한 페이지 ${stuck}개 — 여기부터 본다. 나머지는 순서가 안 온 것이다.`
    : "\n크롤한 것은 전부 색인됐다. 남은 것은 아직 안 가져간 것이라 기다리면 된다.");

  const wrong = [...found].filter(([u, s]) => s.googleCanonical && s.googleCanonical !== u);
  if (wrong.length) console.log(`구글이 다른 주소를 정규로 본 페이지 ${wrong.length}개`);
}

const log = value("--log");
if (log) {
  const line = [
    endDate, days, total?.clicks ?? 0, total?.impressions ?? 0, (total?.position ?? 0).toFixed(1),
    counts?.전체 ?? "", counts?.색인 ?? "", counts?.발견만 ?? "", counts?.모름 ?? "",
  ].join("\t");
  if (!existsSync(log)) appendFileSync(log, "끝날\t기간\t클릭\t노출\t순위\t주소\t색인\t발견만\t그밖\n");
  appendFileSync(log, `${line}\n`);
  console.log(`\n${log}에 한 줄 남겼다.`);
}

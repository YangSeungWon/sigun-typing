/*
 * 방어선 예행연습. 실행: `npm run drill:ops`
 *
 * 유닛 테스트는 규칙이 옳은지를 보고, 이건 **그 규칙이 지금 떠 있는 서버에
 * 실제로 붙어 있는지**를 본다. 둘은 다르다 — 라우트를 옮기거나 미들웨어를
 * 손대면 규칙은 그대로인 채 길만 비켜 갈 수 있고, 그때 유닛 테스트는 전부
 * 초록이다.
 *
 * 운영 DB에 기록을 한 줄 남긴다(닉네임 `예행연습`). 마지막에 지운다.
 *
 *   TARGET=https://sigun-typing.ysw.kr npm run drill:ops
 */
import { keystrokeCount } from "../lib/hangul/keystrokes.ts";
const B = process.env.TARGET ?? "http://localhost:18730";
let pass = 0, fail = 0;
const check = (label: string, passed: boolean, detail = "") => {
  if (passed) {
    pass++;
    console.log("  ok   " + label);
  } else {
    fail++;
    console.log("  FAIL " + label + " " + detail);
  }
};
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${B}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

console.log(`대상 ${B}\n\n[이벤트 레이트리밋]`);
// 기기당 분당 30건. 40번 두드려 보면 뒤쪽은 막혀야 한다.
const device = `drill-${Math.random().toString(36).slice(2, 12)}`;
const codes = [];
for (let i = 0; i < 40; i++) {
  const r = await post("/api/events", { deviceId: device, events: [{ name: "page_view", atMs: Date.now() }] });
  codes.push(r.status);
}
const ok = codes.filter((c) => c === 200).length;
const blocked = codes.filter((c) => c === 429).length;
console.log(`  200 ${ok}건 · 429 ${blocked}건`);
check("기기당 한도가 걸린다", blocked > 0 && ok <= 31, `${ok}/${blocked}`);
check("한도까지는 받아 준다", ok >= 25, String(ok));

// 다른 기기는 그 한도에 걸리지 않아야 한다 — 한 사람이 남을 막을 수 없다.
const other = await post("/api/events", { deviceId: `drill-${Math.random().toString(36).slice(2, 12)}`, events: [{ name: "page_view", atMs: Date.now() }] });
check("다른 기기는 막히지 않는다", other.status === 200, String(other.status));

console.log("\n[기록 위조]");
const token = await (await post("/api/session", { courseId: "sido", mode: "map", seed: 1 })).json();
check("시작 토큰을 받는다", typeof token.token === "string", JSON.stringify(token).slice(0, 80));

const REGIONS = (await import("node:fs")).readFileSync(
  new URL("../data/geo/sido.json", import.meta.url),
  "utf8",
);
// 지도 타이핑은 시드로 순서를 섞는다. 서버도 같은 순서를 기대하므로
// 엔진과 똑같은 mulberry32를 여기서도 돌린다.
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const sido: { code: string; name: string }[] = seededShuffle(
  JSON.parse(REGIONS).regions,
  1,
);

/** 사람처럼 생긴 타임라인을 만든다. 여기에 한 군데씩만 손을 댄다. */
function run({ inflate = 0, robotic = false, tooFast = false } = {}) {
  const keystrokes = [], results = [];
  let t = 0;
  for (const r of sido) {
    const strokes = keystrokeCount(r.name);
    const start = t;
    for (let i = 0; i < strokes; i++) {
      t += robotic ? 100 : tooFast ? 5 : 90 + Math.floor(Math.random() * 140);
      keystrokes.push({ t, n: 1, ok: true });
    }
    results.push({
      id: r.code, answer: r.name, elapsedMs: t - start,
      keystrokes: strokes + inflate, errors: 0, attempts: 1, skipped: false, hinted: false,
    });
  }
  const correct = results.reduce((a, r) => a + r.keystrokes, 0);
  return {
    token: token.token, courseId: "sido", mode: "map", seed: 1, nickname: "예행연습",
    keystrokes, results, hintsUsed: 0,
    claimed: {
      cpm: (correct / t) * 60_000, accuracy: 1, elapsedMs: t, correctKeystrokes: correct,
      totalErrors: 0, completed: results.length, total: results.length, hintsUsed: 0,
      firstTry: results.length, answerRate: 1,
    },
  };
}

for (const [name, payload] of [
  ["타수를 부풀린 기록", run({ inflate: 5 })],
  ["기계처럼 일정한 리듬", run({ robotic: true })],
  ["사람이 낼 수 없는 속도", run({ tooFast: true })],
  ["토큰이 없는 기록", { ...run(), token: "" }],
  ["남의 코스로 바꾼 기록", { ...run(), courseId: "gyeonggi" }],
  ["모드를 바꾼 기록", { ...run(), mode: "learn" }],
]) {
  const r = await post("/api/scores", payload);
  const body = await r.json().catch(() => ({}));
  check(`${name}은 거부된다`, r.status === 400, `${r.status} ${JSON.stringify(body).slice(0, 90)}`);
}

/*
 * 마지막으로 정직한 기록은 통과해야 한다. 이게 없으면 "전부 막는 서버"도
 * 위의 검사를 모두 통과한다 — 방어선이 아니라 벽이 되어 있어도 모른다.
 */
const fresh = await (await post("/api/session", { courseId: "sido", mode: "map", seed: 1 })).json();
/*
 * 토큰과 기기 번호는 여기서 한 번에 얹는다. 만들어 둔 판에 나중에 필드를
 * 덧붙이면 run()이 내놓기로 한 모양과 실제로 보내는 모양이 달라진다.
 */
const honest = {
  ...run(),
  token: fresh.token,
  deviceId: `drill-${Math.random().toString(36).slice(2, 12)}`,
};
/*
 * 실제로 그 시간만큼 기다린다. 서버는 토큰 발급 시각과 제출 시각의 간격보다
 * 긴 판을 받지 않는데(그게 시간 위조를 막는 축이다), 여기서 기다리지 않으면
 * 정직한 기록도 그 규칙에 걸린다. 규칙이 맞는다는 증거이기도 하다.
 */
const wait = honest.claimed.elapsedMs + 700;
console.log(`  (정직한 판 ${Math.round(honest.claimed.elapsedMs / 1000)}초 — 그만큼 기다립니다)`);
await new Promise((r) => setTimeout(r, wait));
const good = await post("/api/scores", honest);
const goodBody = await good.json().catch(() => ({}));
check("정직한 기록은 받아 준다", good.status === 200, `${good.status} ${JSON.stringify(goodBody).slice(0, 120)}`);

if (good.status === 200) {
  console.log(
    "\n  남은 것 지우기:\n" +
      `    docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \\\n` +
      "      -c \"delete from scores where nickname = '예행연습'\"",
  );
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail > 0 ? 1 : 0);

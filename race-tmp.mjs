import pw from "playwright";
const OUT="/tmp/claude-1000/-home-whysw-Documents-sigun-typing/8c5115d9-e30a-4d21-8e51-e314e8bea1ae/scratchpad";
const b=await pw.chromium.launch();
const ctx=await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:2});
const p=await ctx.newPage();
p.on("pageerror", e => console.log("PAGEERR", String(e).slice(0,400)));
await p.goto("http://localhost:3111/rooms",{waitUntil:"networkidle"});
await p.fill('input', "테스터");
await p.selectOption('select', 'jeju');
await p.click('text=방 만들기');
await p.waitForTimeout(2000);
await p.screenshot({path:`${OUT}/race-1.png`});
console.log("--- 대기실 ---\n" + (await p.locator("body").innerText()).slice(0,700));
// 준비 → 시작
for (const label of ["준비", "시작"]) {
  const el = p.locator(`button:has-text("${label}")`).first();
  if (await el.count()) { await el.click().catch(()=>{}); await p.waitForTimeout(600); }
}
await p.waitForTimeout(5000);
await p.screenshot({path:`${OUT}/race-2.png`});
console.log("--- 달리는 중 ---\n" + (await p.locator("body").innerText()).slice(0,500));
await ctx.close(); await b.close();

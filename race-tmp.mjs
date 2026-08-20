import pw from "playwright";
const OUT="/tmp/claude-1000/-home-whysw-Documents-sigun-typing/8c5115d9-e30a-4d21-8e51-e314e8bea1ae/scratchpad";
const b=await pw.chromium.launch();
const ctx=await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:2});
const p=await ctx.newPage();
p.on("pageerror", e=>console.log("PAGEERR",String(e).slice(0,300)));
await p.goto("https://sigun-typing.ysw.kr/rooms",{waitUntil:"networkidle"});
await p.fill('input',"확인용");
await p.selectOption('select','jeju');
await p.click('button:has-text("대결방 만들기")');
await p.waitForTimeout(2500);
await p.click('button:has-text("준비")');
await p.waitForTimeout(600);
await p.click('button:has-text("출발")');
await p.waitForTimeout(5000);
await p.screenshot({path:`${OUT}/prod-race.png`});
console.log("--- 달리는 중 ---\n"+(await p.locator("body").innerText()).slice(0,300));
// 제주 두 곳: 제주시, 서귀포시
for (const name of ["제주시","서귀포시"]) {
  await p.keyboard.type(name, {delay: 40});
  await p.keyboard.press("Enter");
  await p.waitForTimeout(1200);
}
await p.waitForTimeout(2500);
await p.screenshot({path:`${OUT}/prod-done.png`, fullPage:true});
console.log("--- 끝 ---\n"+(await p.locator("body").innerText()).slice(0,600));
await ctx.close(); await b.close();

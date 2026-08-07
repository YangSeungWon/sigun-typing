/**
 * 서비스 주소. sitemap과 robots가 절대 주소를 만들 때 쓴다.
 *
 * 빌드 시점에 정해지므로 도메인이 바뀌면 다시 빌드해야 한다.
 * 그래서 게임 동작에는 쓰지 않는다 — 소켓 주소를 같은 오리진으로 둔 것과 같은 이유다.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "https://sigun-typing.ysw.kr").replace(/\/$/, "");
}

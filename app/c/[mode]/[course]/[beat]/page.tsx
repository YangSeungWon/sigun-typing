import { notFound } from "next/navigation";
import { metadata as buildMeta, resolve, screen } from "@/lib/share/challengeRoute";

/**
 * 이름 없이 보낸 도전장. `/c/map/seoul/41080`
 *
 * 규칙과 생김새는 lib/share/challengeRoute.tsx에 있다. 이름이 붙은 주소와
 * 짝이고, 둘로 나뉜 사정도 거기 적어 두었다.
 */
type Props = PageProps<"/c/[mode]/[course]/[beat]">;

async function found(params: Props["params"]) {
  const { mode, course, beat } = await params;
  return resolve(mode, course, beat, null);
}

export default async function ChallengePage({ params }: Props) {
  const it = await found(params);
  if (!it) notFound();
  return screen(it);
}

export async function generateMetadata({ params }: Props) {
  return buildMeta(await found(params));
}

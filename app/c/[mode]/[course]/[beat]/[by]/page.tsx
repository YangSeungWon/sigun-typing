import { notFound } from "next/navigation";
import { metadata as buildMeta, resolve, screen } from "@/lib/share/challengeRoute";

/**
 * 이름과 함께 보낸 도전장. `/c/map/seoul/41080/승원`
 *
 * 규칙과 생김새는 lib/share/challengeRoute.tsx에 있다.
 */
type Props = PageProps<"/c/[mode]/[course]/[beat]/[by]">;

async function found(params: Props["params"]) {
  const { mode, course, beat, by } = await params;
  return resolve(mode, course, beat, by);
}

export default async function ChallengePage({ params }: Props) {
  const it = await found(params);
  if (!it) notFound();
  return screen(it);
}

export async function generateMetadata({ params }: Props) {
  return buildMeta(await found(params));
}

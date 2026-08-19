import { card, CARD_SIZE, resolve } from "@/lib/share/challengeRoute";

export const size = CARD_SIZE;
export const contentType = "image/png";

/** 이름 없이 보낸 도전장의 카드 그림. */
export default async function Image({
  params,
}: PageProps<"/c/[mode]/[course]/[beat]">) {
  const { mode, course, beat } = await params;
  return card(resolve(mode, course, beat, null));
}

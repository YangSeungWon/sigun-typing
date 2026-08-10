import { redirect } from "next/navigation";
import { MODES } from "@/lib/game/modes";

export function generateStaticParams() {
  return Object.keys(MODES).map((mode) => ({ mode }));
}

/**
 * 모드별 코스 목록이 있던 자리.
 *
 * `지도 타이핑 / 타임어택 / 이름 보고 익히기 / 실력 테스트`를 상단 탭으로
 * 두고 그 아래에 코스를 늘어놓았다. 그러면 사용자가
 *
 *   나는 뭘 할까 → 모드부터 고른다 → 그다음 지역을 고른다
 *
 * 순서로 생각하게 되는데, 이 서비스는 반대가 자연스럽다.
 *
 *   어디를 해 볼까 → 그 지역을 어떻게 해 볼까
 *
 * 네 모드는 사이트의 섹션이 아니라 **코스 하나를 어떻게 할지 정하는 방법**
 * 이다. 그걸 전역 네비게이션에 두면 처음 온 사람은 넷 중 무엇이 본 게임인지
 * 알 수 없다. 여백이나 모양을 아무리 다듬어도 그 어색함은 안 없어진다 —
 * 배치가 틀렸기 때문이다.
 *
 * 이제 코스 고르기는 첫 화면이고, 모드는 코스 상세에서 고른다. 이 주소는
 * 이미 나간 링크가 있으므로 살려 두고 첫 화면으로 보낸다.
 */
export default async function ModePickerRedirect({
  params,
}: PageProps<"/play/[mode]">) {
  await params;
  redirect("/");
}

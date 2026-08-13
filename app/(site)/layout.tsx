import { DesktopHeader } from "@/components/nav/DesktopHeader";
import { MobileHeader } from "@/components/nav/MobileHeader";
import { MobileBottomNav } from "@/components/nav/MobileBottomNav";
import { SiteFooter } from "@/components/nav/SiteFooter";

/**
 * 셸을 두르는 화면들.
 *
 * 이 그룹 밖에 있는 것은 `/play`와 `/review` — 판이 도는 화면이다. 거기에
 * 탭 바가 깔리면 지도 아래 절반이 메뉴가 되고, 무엇보다 판 도중에 나가는 문이
 * 엄지 밑에 넷 생긴다. 그건 게임이 아니다.
 *
 * 주소로 갈라도(`pathname.startsWith("/play")`) 되지만 그러지 않았다. 그러면
 * 셸이 모든 라우트에서 클라이언트 컴포넌트가 되어 플레이 번들에 아무것도
 * 안 그릴 네비 코드가 실린다. 그리고 "이 화면에는 크롬이 없다"는 라우트의
 * 성질이라, 파일이 있는 자리가 말하는 편이 문자열보다 낫다 — 라우트 이름이
 * 바뀌면 문자열은 조용히 썩는다.
 *
 * 괄호로 묶은 폴더는 주소에 나오지 않는다. `/`도 `/courses`도 그대로다.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    /*
     * flex-1과 flex-col을 그대로 이어 준다. 안쪽 화면들이 `flex-1`인 main과
     * `mt-auto`인 푸터로 자리를 잡고 있어서, 여기서 끊기면 짧은 화면의 푸터가
     * 본문 바로 밑에 붙는다.
     *
     * 아래 여백은 탭 바 높이(3.5rem)에 홈 인디케이터를 더한 만큼. 넓은 화면에는
     * 탭 바가 없으므로 md에서 0으로 되돌린다.
     */
    <div className="app-shell flex min-h-full flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <DesktopHeader />
      <MobileHeader />
      {children}
      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}

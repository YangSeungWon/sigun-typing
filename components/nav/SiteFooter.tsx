import Link from "next/link";
import { DATA_VINTAGE } from "@/data/vintage";
import { ATLAS_HOME } from "@/lib/atlas";

/**
 * 어느 화면에서나 같은 아랫줄.
 *
 * 첫 화면과 코스 화면이 각자 푸터를 짓고 있었고, 둘의 내용이 달랐다 —
 * 데이터 출처와 약관은 첫 화면에만, 이용안내와 랭킹은 코스 화면에만.
 * 어느 쪽도 그 화면의 성질이 아니라 사이트의 성질이다.
 *
 * 문서 화면 셋(`/guide` · `/privacy` · `/terms`)이 그때 통합에서 빠져 있었다.
 * 셸이 이 푸터를 깔아 주는데 자기 푸터도 그대로 들고 있어서, 약관 페이지
 * 아래쪽에 `이용약관` 링크가 세로로 두 번 놓였다. `<footer>`도 두 개였다.
 *
 * 랭킹은 여기 없다. 헤더에 있고, 같은 링크를 위아래로 두 번 두면 아래 것은
 * 읽히지 않는다. 좁은 화면에서 랭킹으로 가는 길은 /notes 안에 있다 — 내 기록
 * 옆이 남의 기록을 궁금해하는 자리다.
 *
 * 이용안내는 `md:hidden`으로 좁은 화면에만 둔다. 넓은 화면에는 헤더에 있으니
 * 중복이고, 좁은 화면에는 헤더 링크가 아예 없다(갈 곳은 전부 아래 탭 바인데
 * 그건 넷으로 고정이다). 한때 그냥 뺐었는데, 그러면 이용안내로 가는 유일한
 * 길이 약관 페이지 안의 링크가 되어 두 번 눌러야 닿았다.
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-5xl flex-col gap-2 border-t border-edge px-6 py-6 font-mono text-sm text-dim">
      {/*
        기준 연도가 변천사로 가는 문이다.
        메뉴를 하나 더 다는 대신 이미 있는 줄을 쓴다 — 이 줄이 하는 말이
        "이 자료는 몇 년 것인가"이고, 거기서 자연히 이어지는 물음이
        "그럼 전에는 어땠나"다.

        좁은 화면에는 헤더 링크가 없어서(갈 곳은 전부 아래 탭 바인데 그건
        넷으로 고정이다) 이 줄이 유일한 길이기도 하다.
      */}
      <Link
        href="/history"
        className="w-fit underline decoration-edge underline-offset-4 transition-colors hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="flex flex-wrap gap-x-3">
          <span>행정구역 데이터 기준 {DATA_VINTAGE.year}</span>
          <span>{DATA_VINTAGE.boundarySource}</span>
        </span>
      </Link>
      <span className="flex flex-wrap gap-x-3">
        <span>물길 © OpenStreetMap</span>
        <span>지형 NASA SRTM</span>
      </span>

      <span className="flex gap-4 pt-1">
        <Link href="/guide" className="transition-colors hover:text-ink md:hidden">
          이용안내
        </Link>
        <Link href="/privacy" className="transition-colors hover:text-ink">
          개인정보 처리방침
        </Link>
        <Link href="/terms" className="transition-colors hover:text-ink">
          이용약관
        </Link>
        {/*
          같은 사람이 만든 지도 퀴즈. 방향이 반대라 서로 뺏지 않는다 — 여기는
          지도를 보고 이름을 치고, 거기는 이름을 보고 지도에서 찾는다.

          링크 교환처럼 안 읽히게 하는 것은 자리와 문구다. 자리는 약관 옆이고
          — 사이트에 관한 사실을 적는 줄이지 무언가를 권하는 줄이 아니다 —
          문구는 그냥 이름이다. `추천`도 `함께 보기`도 없다.
        */}
        <a
          href={ATLAS_HOME}
          target="_blank"
          rel="noopener"
          className="transition-colors hover:text-ink"
        >
          한국 지리 퀴즈
        </a>
      </span>
    </footer>
  );
}

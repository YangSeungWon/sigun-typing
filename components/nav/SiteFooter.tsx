import Link from "next/link";
import { DATA_VINTAGE } from "@/data/vintage";

/**
 * 어느 화면에서나 같은 아랫줄.
 *
 * 첫 화면과 코스 화면이 각자 푸터를 짓고 있었고, 둘의 내용이 달랐다 —
 * 데이터 출처와 약관은 첫 화면에만, 이용안내와 랭킹은 코스 화면에만.
 * 어느 쪽도 그 화면의 성질이 아니라 사이트의 성질이다.
 *
 * 이용안내와 랭킹은 여기서 뺐다. 헤더에 있고, 같은 링크를 위아래로 두 번
 * 두면 아래 것은 읽히지 않는다. 여기 남는 것은 헤더에 둘 수 없는 것들 —
 * 데이터가 언제 것인지, 그리고 법적 문서.
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-5xl flex-col gap-2 border-t border-concrete-deep px-6 py-6 font-mono text-xs text-dim">
      <span>
        행정구역 데이터 기준 {DATA_VINTAGE.year} · {DATA_VINTAGE.boundarySource}
      </span>
      <span className="flex gap-4 pt-1">
        <Link href="/privacy" className="transition-colors hover:text-ink">
          개인정보 처리방침
        </Link>
        <Link href="/terms" className="transition-colors hover:text-ink">
          이용약관
        </Link>
      </span>
    </footer>
  );
}

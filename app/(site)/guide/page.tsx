import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { Keycap } from "@/components/Keycap";
import { COURSES } from "@/data/courses";
import { DATA_VINTAGE, VINTAGE_LABEL } from "@/data/vintage";
import { MODES, MODE_LABELS, MODE_LADDER } from "@/lib/game/modes";

export const metadata = {
  title: "이용안내",
  description:
    "지도에 표시된 지역의 이름을 입력하는 게임입니다. 규칙, 모드, 기록 계산 방법을 설명합니다.",
};

/**
 * 이용안내.
 *
 * 회상 게임은 따라 치는 게임보다 설명이 더 필요하다. 화면에는 "지도에 표시된
 * 지역의 이름을 입력하세요" 한 줄뿐인데, 처음 온 사람이 첫 문제에서 나가는
 * 이유는 어려워서일 수도 있고 무엇을 하는 건지 몰라서일 수도 있다. 둘은
 * 처방이 완전히 다르므로, 후자를 없앨 수 있는 자리는 없애 둔다.
 *
 * 여기 적힌 숫자는 전부 코드에서 가져온다. 문서와 게임이 어긋나는 순간
 * 이 페이지는 안 읽느니만 못해진다.
 */
export default function GuidePage() {
  const placeCount = COURSES.reduce((sum, c) => sum + c.regions.length, 0);
  const hintSeconds = (MODES.map.hintPenaltyMs ?? 0) / 1000;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <BackLink href="/">시군 타이핑</BackLink>
        <h1 className="text-4xl font-bold tracking-tight">이용안내</h1>
        <p className="text-lg text-dim">
          지도에 표시된 지역이 어디인지 떠올려, 이름을 직접 입력하는 게임입니다.
        </p>
      </header>

      <section className="flex flex-col gap-3 text-lg leading-relaxed">
        <p>지도에 표시된 지역의 이름을 입력하세요.</p>
        <p>모르겠으면 힌트를 쓸 수 있습니다.</p>
        <p>최대한 빠르고 정확하게 전국을 완성해 보세요.</p>
      </section>

      {/*
        나머지는 전부 접어 둔다.
        규칙 하나하나는 이유가 있지만, 게임을 시작하기 전에 읽어야 할 것은
        아니다. 대부분은 한 판 해 보면 알게 되고, 궁금해진 사람만 열어 보면
        된다. 설명이 길어질수록 이 게임은 약해진다 — 설명보다 플레이가 빠른
        게임이기 때문이다.
      */}
      <div className="flex flex-col gap-2">
        <Fold title="키보드">
          <dl className="flex flex-col gap-3">
            <KeyRow keys="Space" label="제출">
              다 쳤으면 스페이스로 넘깁니다. 엔터도 같습니다. 저절로 넘어가지
              않으므로 넘어가는 순간은 언제나 내가 정합니다. 틀려도 그 자리에
              그대로 있고 다시 떠올려 볼 수 있습니다.
            </KeyRow>
            <KeyRow keys="Tab" label="힌트">
              초성을 보여 줍니다(<Kbd>의정부시</Kbd> → <Kbd>ㅇㅈㅂㅅ</Kbd>). 기록에{" "}
              {hintSeconds}초가 더해집니다 — 그 판은 사실상 순위에서 내려온다는
              뜻입니다. 한 번 더 누르면 정답을 봅니다.
            </KeyRow>
            <KeyRow keys="Esc" label="모르겠어요">
              정답을 보고 넘어갑니다. 그 지역은 다음에 다시 나옵니다.
            </KeyRow>
          </dl>
          <p className="text-dim">모바일에서는 같은 기능이 버튼으로 나옵니다.</p>
        </Fold>

        <Fold title="틀리면 어떻게 되나요">
          <p>
            스페이스로 낸 답이 틀리면 오답 한 번으로 적고 그 자리에 그대로
            머무릅니다. 친 글자도 지워지지 않으므로 틀린 자리만 고치면 됩니다.
            정 모르겠으면 <Kbd>Esc</Kbd>로 정답을 보고 넘어갑니다.
          </p>
          <p>
            치는 동안에는 맞았는지 틀렸는지 알려 주지 않습니다. 한 글자 칠
            때마다 색이 바뀌면 그게 곧 답을 알려 주는 셈입니다. 떠올리는
            게임이 글자 맞히기 게임이 되어 버립니다.
          </p>
          <p>
            결과 화면에는 무엇을 무엇으로 착각했는지가 남습니다. 안산시를
            연천군이라고 답했다면 그 두 곳을 나란히 보는 것이 다시 외우는 데
            가장 빠릅니다.
          </p>
        </Fold>

        <Fold title="이름은 어디까지 인정되나요">
          <p>
            지도에 적히는 이름을 그대로 칩니다 — <Kbd>수원시</Kbd>,{" "}
            <Kbd>종로구</Kbd>, <Kbd>가평군</Kbd>.
          </p>
          <p>
            접미사를 떼면 규칙이 이름마다 달라집니다. <Kbd>중구</Kbd>에서 구를
            떼면 남는 것이 없고, <Kbd>광주</Kbd>는 광주시인지 광주광역시인지
            알 수 없습니다.
          </p>
          <p>
            시도 코스는 짧은 이름이 기준입니다. <Kbd>제주</Kbd>·
            <Kbd>제주도</Kbd>·<Kbd>제주특별자치도</Kbd>가 모두 정답입니다.
          </p>
          <p>
            치는 도중의 글자는 오타로 세지 않습니다. <Kbd>고성</Kbd>을 칠 때
            화면에는 고 → 곳 → 고서 → 고성이 지나가지만, 정답으로 가는 길 위에
            있는 한 괜찮습니다.
          </p>
        </Fold>

        <Fold title="모드">
          <dl className="flex flex-col divide-y divide-concrete-deep">
            {MODE_LADDER.map((mode) => (
              <div key={mode} className="flex flex-col gap-1 py-3 first:pt-0">
                <dt className="font-medium">{MODE_LABELS[mode]}</dt>
                <dd className="text-dim">{MODE_DESCRIPTIONS[mode]}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-1 py-3">
              <dt className="font-medium">{MODE_LABELS.multi}</dt>
              <dd className="text-dim">{MODE_DESCRIPTIONS.multi}</dd>
            </div>
          </dl>
        </Fold>

        <Fold title="기록과 랭킹">
          <p>
            타수는 두벌식 자판 기준입니다. <Kbd>값</Kbd>은 ㄱ·ㅏ·ㅂ·ㅅ 네 타,{" "}
            <Kbd>좌</Kbd>는 ㅈ·ㅗ·ㅏ 세 타입니다. 맞힌 글자만 셉니다.
          </p>
          <p>
            정답을 보고 넘어간 지역은 공식 기록에 들어가지 않습니다. 힌트를 쓰면
            그만큼 시간이 더해집니다.
          </p>
          <p>
            기록은 서버가 다시 계산해 확인하며, 같은 규칙으로 끝낸 기록끼리만
            순위를 비교합니다. 게임 규칙이나 코스 내용이 바뀌면 이전 기록과 따로
            집계됩니다.
          </p>
          <p>
            순위표는 <Kbd>{MODE_LABELS.map}</Kbd> 하나입니다.{" "}
            <Kbd>{MODE_LABELS.learn}</Kbd>는 답이 화면에 있어 재는 것이 회상이
            아니라 타자 속도라서 순위에 넣지 않습니다. 개인 기록에는 남습니다.
          </p>
        </Fold>

        <Fold title="자료">
          <p>
            코스 {COURSES.length}개, 지역 {placeCount}곳. 경계는{" "}
            {DATA_VINTAGE.boundarySource}({DATA_VINTAGE.year}), 이름과 코드는{" "}
            {DATA_VINTAGE.codeSource}를 따릅니다.
          </p>
          <p className="text-dim">
            {VINTAGE_LABEL}입니다. 이후 개편된 지역은 반영되어 있지 않을 수
            있습니다.
          </p>
        </Fold>
      </div>

      <nav className="flex flex-wrap gap-3 border-t border-concrete-deep pt-8">
        <Link
          href="/play/map/sido?from=guide"
          className="rounded-lg bg-sign px-5 py-3 font-medium text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          전국 17 시도부터 해 보기
        </Link>
        <Link
          href="/play/learn/sido?from=guide"
          className="rounded-lg border border-concrete-deep px-5 py-3 font-medium transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          이름 보고 연습하기
        </Link>
      </nav>

      <footer className="mt-auto flex gap-4 border-t border-concrete-deep pt-6 font-mono text-xs text-dim">
        <Link href="/privacy" className="transition-colors hover:text-ink">
          개인정보 처리방침
        </Link>
        <Link href="/terms" className="transition-colors hover:text-ink">
          이용약관
        </Link>
      </footer>
    </main>
  );
}

/**
 * 모드 설명은 코스 선택 화면의 한 줄(MODE_HINTS)보다 길다.
 * 거기서는 이미 무슨 게임인지 아는 사람이 고르는 중이고, 여기서는 모르는
 * 사람이 읽는 중이라 전제가 다르다.
 */
const MODE_DESCRIPTIONS: Record<keyof typeof MODES, string> = {
  map: "지도만 보고 이름을 떠올려 입력합니다. 순서는 매번 섞이고, 막히면 초성 힌트를 쓰거나 정답을 보고 넘어갈 수 있습니다.",
  learn: "이름이 화면에 적혀 있고 그대로 따라 칩니다. 지명과 위치를 익히는 자리이지, 기억을 시험하는 모드가 아닙니다.",
  multi: "최대 여덟 명이 같은 지도를 놓고 동시에 답합니다. 진행도가 실시간으로 보입니다.",
};

/** 궁금해진 사람만 여는 상자. 기본은 접힌 상태다. */
function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-concrete-deep bg-paint/60 px-5 py-4">
      <summary className="cursor-pointer list-none font-medium marker:content-none">
        <span className="flex items-center justify-between gap-4">
          {title}
          <span className="font-mono text-sm text-dim transition-transform group-open:rotate-90">
            ›
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-3 pt-4 leading-relaxed text-ink/90">
        {children}
      </div>
    </details>
  );
}

/** 본문 안에서 입력 예시나 화면의 글자를 가리킬 때. */
function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-sign">{children}</span>;
}

function KeyRow({
  keys,
  label,
  children,
}: {
  keys: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center gap-2 font-medium">
        <Keycap>{keys}</Keycap>
        {label}
      </dt>
      <dd className="text-ink/90">{children}</dd>
    </div>
  );
}


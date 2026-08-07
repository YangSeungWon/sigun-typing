import Link from "next/link";
import { Keycap } from "@/components/Keycap";
import { COURSES } from "@/data/courses";
import { GRADUATE_STREAK } from "@/lib/score/mistakes";
import { MODES, MODE_LABELS, MODE_LADDER } from "@/lib/game/modes";

export const metadata = {
  title: "이용안내 — 시군 타이핑",
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
  const hintSeconds = (MODES.quiz.hintPenaltyMs ?? 0) / 1000;
  const timeLimit = (MODES.timeattack.timeLimitMs ?? 0) / 1000;
  const wrongPenalty = (MODES.timeattack.penaltyMs ?? 0) / 1000;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="font-mono text-xs tracking-[0.15em] text-dim uppercase transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          ← 시군 타이핑
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">이용안내</h1>
        <p className="text-lg text-dim">
          지도에 표시된 지역이 어디인지 떠올려, 이름을 직접 입력하는 게임입니다.
        </p>
      </header>

      <Section title="한 판은 이렇게 흘러갑니다">
        <Steps
          items={[
            <>
              코스를 고르고 <Kbd>출발</Kbd>을 누릅니다. 아무 키나 눌러도 시작합니다.
            </>,
            <>
              세 번 세고 출발합니다. 손을 자판에 올려 둘 시간입니다.
            </>,
            <>
              지도에 <strong>한 곳만 노랗게</strong> 칠해집니다. 거기가 문제입니다.
              {" "}
              <span className="text-dim">
                (이름을 보여 주는 연습에서는 노랑을 쓰지 않습니다. 노랑은 답해야 할
                곳에만 씁니다.)
              </span>
            </>,
            <>
              그 지역의 이름을 칩니다. 맞으면 <strong>바로 다음 문제</strong>로
              넘어갑니다 — 확인 버튼은 없습니다.
            </>,
            <>
              맞힌 곳은 초록으로, 못 맞힌 곳은 붉은색으로 남습니다. 결과 화면에
              <strong> 다시 볼 곳</strong>이 이름으로 정리됩니다.
            </>,
          ]}
        />
      </Section>

      <Section title="이름은 짧게 쳐도 됩니다">
        <p>
          <Kbd>수원</Kbd>이면 충분하고 <Kbd>수원시</Kbd>라고 쳐도 맞습니다. 시도
          코스에서는 <Kbd>제주</Kbd>·<Kbd>제주도</Kbd>·<Kbd>제주특별자치도</Kbd>가
          모두 정답입니다.
        </p>
        <p>
          조합 중인 글자는 틀린 것으로 세지 않습니다. <Kbd>고성</Kbd>을 치는 동안
          화면에는 고 → 곳 → 고서 → 고성이 지나가지만, 정답으로 가는 길 위에 있는
          한 오타가 아닙니다. 길을 벗어난 순간에만 빨갛게 표시됩니다.
        </p>
      </Section>

      <Section title="막혔을 때">
        <dl className="flex flex-col gap-4">
          <KeyRow keys="Tab" label="초성 힌트">
            첫 글자들의 자음만 보여 줍니다(<Kbd>의정부</Kbd> → <Kbd>ㅇㅈㅂ</Kbd>).
            기록에 {hintSeconds}초가 더해지고, 시간 제한이 있는 모드에서는 남은
            시간에서 깎입니다. 한 문제에 한 번만 셉니다.
          </KeyRow>
          <KeyRow keys="Esc" label="모르겠어요">
            초성을 봐도 떠오르지 않을 때 씁니다. <strong>정답을 보여 준 뒤</strong>
            다음으로 넘어가고, 그 지역은 오답노트에 담깁니다. 완주 수에는 들어가지
            않습니다 — 정답을 봐서 이득이 생기면 그건 힌트가 아니라 지름길입니다.
          </KeyRow>
        </dl>
        <p className="text-dim">
          모드에 따라 둘 다 없을 수도 있습니다. 지금 쓸 수 있는 키는 입력판 아래에
          표시됩니다.
        </p>
      </Section>

      <Section title="모드">
        <dl className="flex flex-col divide-y divide-concrete-deep">
          {MODE_LADDER.map((mode) => (
            <div key={mode} className="flex flex-col gap-1 py-3 first:pt-0">
              <dt className="font-medium">
                {MODE_LABELS[mode]}
                {mode === "quiz" && (
                  <span className="ml-2 font-mono text-xs text-sign">본편</span>
                )}
              </dt>
              <dd className="text-dim">{MODE_DESCRIPTIONS[mode]}</dd>
            </div>
          ))}
          <div className="flex flex-col gap-1 py-3">
            <dt className="font-medium">{MODE_LABELS.multi}</dt>
            <dd className="text-dim">{MODE_DESCRIPTIONS.multi}</dd>
          </div>
        </dl>
        <p>
          타임어택은 {timeLimit}초 안에 최대한 많이 맞히는 모드이고, 틀리면{" "}
          {wrongPenalty}초가 깎입니다. 연습을 뺀 모든 모드에서 지도가 문제입니다.
        </p>
      </Section>

      <Section title="기록은 이렇게 셉니다">
        <dl className="flex flex-col gap-3">
          <Term label="타수(타/분)">
            두벌식 자판을 기준으로 셉니다. <Kbd>값</Kbd>은 ㄱ·ㅏ·ㅂ·ㅅ 네 타,{" "}
            <Kbd>좌</Kbd>는 ㅈ·ㅗ·ㅏ 세 타입니다. 된소리(<Kbd>ㄲ</Kbd>)는 관례대로 한
            타로 봅니다. 맞힌 글자만 세므로 아무 키나 두드려서는 올라가지 않습니다.
          </Term>
          <Term label="정확도">실제로 친 타수 중 정답으로 인정된 비율입니다.</Term>
          <Term label="시간">
            힌트를 썼다면 그만큼 더해집니다. 눌러서 얻은 시간을 기록에 되돌려 놓는
            것입니다.
          </Term>
        </dl>
      </Section>

      <Section title="랭킹">
        <p>
          기록은 브라우저가 보낸 숫자를 그대로 믿지 않고, 서버가 타건 기록을 다시
          재생해 직접 계산합니다. 사람이 칠 수 없는 속도나 앞뒤가 맞지 않는 기록은
          등록되지 않습니다.
        </p>
        <p>
          순위표는 <strong>같은 코스·같은 코스 판번호·같은 채점 규칙</strong>끼리만
          비교합니다. 코스에 지역이 늘거나 채점 방식이 바뀌면 총 타수가 달라져
          예전 기록과 견줄 수 없기 때문입니다.
        </p>
      </Section>

      <Section title="오답노트">
        <p>
          틀리거나, 건너뛰거나, 힌트를 본 지역은 <strong>몰랐다</strong>는 뜻으로
          기기에 기록됩니다. 힌트를 보고 맞힌 것도 마찬가지입니다 — 초성을 봐야
          했다면 아직 모르는 것입니다.
        </p>
        <p>
          <Link href="/notes" className="underline underline-offset-4 hover:text-sign">
            오답노트
          </Link>
          에서 틀린 곳만 모아 다시 풀 수 있고, {GRADUATE_STREAK}번 연속으로 깨끗하게
          맞히면 목록에서 빠집니다. 이 기록은 이 기기에만 있고 서버로 보내지 않습니다.
        </p>
      </Section>

      <Section title="멀티플레이">
        <p>
          방을 만들면 여섯 자리 코드가 나옵니다. 그 코드를 알려 주면 최대 여덟 명이
          같은 지도를 놓고 동시에 답합니다. 전원이 준비하면 방장이 출발시킬 수
          있습니다.
        </p>
        <p>
          경주에서도 이름은 가려집니다. 초성 힌트는 쓸 수 있지만 추가 시간을 물지
          않습니다 — 힌트를 읽는 동안 상대가 앞서 나가는 것이 이미 값입니다.
          건너뛰기는 없습니다. 순위가 진행 칸수로 매겨지므로, 넘길 수 있으면 다 넘긴
          사람이 1등이 되기 때문입니다.
        </p>
      </Section>

      <Section title="자료">
        <p>
          코스 {COURSES.length}개, 지역 {placeCount}곳. 경계 자료는 통계청 SGIS
          행정구역경계(2025)를 단순화해 쓰고, 지역 이름과 코드는 행정표준코드
          법정동코드를 따릅니다.
        </p>
        <p className="text-dim">
          2025년 행정구역 기준이며 이후 개편된 지역은 반영되어 있지 않을 수 있습니다.
          정확성이 필요한 용도로는 소관 기관의 공식 자료를 확인해 주세요.
        </p>
      </Section>

      <nav className="flex flex-wrap gap-3 border-t border-concrete-deep pt-8">
        <Link
          href="/play/quiz/sido?from=guide"
          className="rounded-lg bg-sign px-5 py-3 font-medium text-paint transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          전국 17 시도부터 해 보기
        </Link>
        <Link
          href="/play/single/sido?from=guide"
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
  quiz: "지도만 보고 이름을 떠올려 입력합니다. 순서는 매번 섞이고, 막히면 초성 힌트를 쓰거나 정답을 보고 넘어갈 수 있습니다.",
  timeattack: "같은 규칙에 시간 제한이 붙습니다. 순서가 섞이고 오답은 시간을 깎습니다.",
  single: "이름이 화면에 적혀 있고 그대로 따라 칩니다. 지명과 위치를 익히는 자리이지, 기억을 시험하는 모드가 아닙니다.",
  memorize: "힌트 없이 코스 순서 그대로 끝까지 갑니다. 모르겠으면 정답을 보고 넘어갈 수는 있습니다.",
  multi: "최대 여덟 명이 같은 지도를 놓고 동시에 답합니다. 진행도가 실시간으로 보입니다.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

/** 본문 안에서 입력 예시나 화면의 글자를 가리킬 때. */
function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-sign">{children}</span>;
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-concrete-deep font-mono text-xs tabular-nums">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
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

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-medium">{label}</dt>
      <dd className="text-ink/90">{children}</dd>
    </div>
  );
}

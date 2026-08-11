"use client";

import { initials } from "@/lib/hangul/jamo";
import { matchProgress, type CharStatus } from "@/lib/hangul/match";

const CHAR_TONE: Record<CharStatus, string> = {
  // 아직 안 친 글자는 판면에 옅게 새겨져 있다 — 다음에 뭘 쳐야 하는지 보여준다.
  untyped: "text-paint/35",
  // 조합 중. 중앙선 노랑 — 오타가 아니라 지나가는 중이라는 신호.
  pending: "text-centerline",
  correct: "text-paint",
  wrong: "text-alert",
};

interface SignPlateProps {
  /** 목표 지역명 */
  target: string;
  /** 현재 입력 (IME 조합 중 문자열 포함) */
  typed: string;
  /** 입력창에 포커스가 있는지 — 판면 테두리로 표시한다 */
  focused: boolean;
  /** 포기해서 정답을 보여 주는 중. 맞힌 것처럼 보이면 안 된다. */
  revealed?: boolean;
  /**
   * 표지판에 함께 적을 로마자. 이름이 이미 보이는 상황에서만 쓴다 —
   * 가린 모드에서 로마자를 적으면 그게 곧 답이다.
   */
  roman?: string;
  /** 퀴즈 모드처럼 정답을 가려야 할 때. 아직 안 친 글자를 ○로 덮는다. */
  masked?: boolean;
  /** 초성 힌트를 열었는지. 가려진 글자를 ○ 대신 초성으로 보여준다. */
  hinted?: boolean;
  /**
   * 오답을 언제 판정하는가. 모드 설정과 같은 값이다.
   *
   * `"enter"`이면 **치는 동안 아무 색도 바뀌지 않는다.** 맞은 글자를 하얗게,
   * 틀린 글자를 빨갛게 칠하는 순간 그 자체가 답을 알려 주기 때문이다 —
   * 초성을 하나씩 눌러 보며 색이 바뀌는지만 봐도 정답을 좁힐 수 있다.
   * 판정은 엔터를 친 뒤에 온다.
   */
  judge?: "live" | "enter";
  /** 오타가 날 때마다 증가하는 값. 바뀌면 판면이 흔들린다. */
  erroredAt?: number;
  /**
   * 지금 판면에 있는 이 답이 이미 거부되었는지. 판면이 빨개진다.
   *
   * 흔들림(erroredAt)과 따로 받는다. 따라치기에서는 경로를 벗어난 순간에
   * 흔들리지만, 빨갛게 물드는 것은 **제출이 거부된 답**에만이다 —
   * 치는 도중에 빨개지면 그게 곧 정답 판정이다.
   *
   * 시간이 아니라 입력에 매인 상태다. 타이머로 껐다면 손을 놓고 있는 동안
   * 방금 무슨 일이 있었는지가 화면에서 사라진다. 한 글자만 고쳐도 곧바로
   * 원래 색으로 돌아오고, 같은 답을 다시 만들면 다시 빨개진다.
   */
  rejected?: boolean;
  /** 지역을 통과할 때마다 증가하는 값. 바뀌면 판면이 한 번 튄다. */
  advancedAt?: number;
  /** 판면의 제출 표시를 눌렀을 때. 없으면 표시만 하고 누를 수는 없다. */
  onSubmit?: () => void;
}

/**
 * 이 게임의 서명 요소. 목표 지역명을 도로 안내표지 판면 위에 직접 띄우고,
 * 입력 상태에 따라 글자 색이 바뀐다. 별도의 입력 상자를 보여주지 않는 이유는
 * 표지판 자체가 주인공이기 때문이다 — 실제 input은 시각적으로 숨겨져 있다.
 */
/** 글자 줄의 모양. 빈 판이 높이를 맞출 때도 같은 값을 써야 한다. */
const CHAR_ROW =
  "flex items-end justify-center gap-1 text-3xl font-bold tracking-tight sm:gap-2 sm:text-6xl";

export function SignPlate({
  target,
  typed,
  focused,
  masked = false,
  revealed = false,
  roman,
  hinted = false,
  judge = "live",
  erroredAt = 0,
  rejected = false,
  advancedAt = 0,
  onSubmit,
}: SignPlateProps) {
  const { statuses } = matchProgress(target, typed);
  const chars = [...target];
  const typedChars = [...typed];
  /*
   * 제출로 판정하는 모드에서는 색이 곧 답이므로, 친 글자와 안 친 글자만
   * 구분하고 맞고 틀림은 구분하지 않는다.
   */
  const blind = judge === "enter" && !revealed;

  /**
   * 정답의 **글자 수를 숨긴다.**
   *
   * 예전에는 한 글자만 쳐도 `○`으로 남은 자리가 드러났다. 그러면 첫 타건
   * 자체가 힌트 요청이 되고, 아무것도 안 쳤을 때와 한 글자 쳤을 때 문제의
   * 난이도가 달라진다. 게다가 초성 힌트는 5초를 물고 파는 정보인데 그보다
   * 약한 길이 정보가 공짜인 셈이라 앞뒤가 안 맞았다.
   *
   * 규칙은 하나다 — **힌트를 열기 전에는 길이를 알려 주지 않는다.** 그래서
   * 힌트를 열지 않은 동안 판면에 있는 것은 내가 친 글자뿐이다.
   */
  const lengthHidden = masked && !hinted && !revealed;
  /** 판면에 그릴 칸. 길이를 숨기는 동안에는 친 만큼만 있다. */
  const slots = lengthHidden ? typedChars : chars;
  const cursor = blind
    ? Math.min(typedChars.length, slots.length)
    : statuses.findIndex((s) => s === "untyped" || s === "pending");
  // 목표 길이를 넘겨 친 글자들. 보여 주지 않으면 몇 자를 지워야 할지 알 수 없다.
  // 길이를 숨기는 동안에는 "넘겼다"는 것 자체가 길이를 알려 주므로 없다.
  const extra = lengthHidden ? [] : typedChars.slice(chars.length);

  /** 가린 모드에서 아직 한 글자도 안 쳤을 때. 판면은 빈 채로 기다린다. */
  const idle = masked && typedChars.length === 0 && !hinted && !revealed;

  /** 초성 트랙. 자리를 잡아 두므로 입력이 바뀌어도 움직이지 않는다. */
  const showHint = hinted && masked && !revealed;
  const hintInitials = showHint ? [...initials(target)] : [];

  /** 거부된 답이 아직 판면에 남아 있는 동안. */
  const rejecting = rejected && !revealed;

  /**
   * 한 칸에 무엇을 그릴 것인가.
   *
   * 가린 모드에서는 **절대 목표 글자를 그리지 않는다.** 예전에는 글자가
   * pending이 되는 순간 목표를 그려서, 초성 하나만 맞혀도 답이 통째로
   * 드러났다(`ㅅ` → `수`).
   *
   * 오타 칸에도 목표 대신 실제로 친 글자를 그린다. 화면에 목표만 보이면
   * 내가 무엇을 쳤는지, 몇 자를 지워야 하는지 알 방법이 없다.
   *
   * 조합 중인 칸도 마찬가지다. `곡`을 칠 때 판면이 내내 `곡`이면 지금 손이
   * ㄱ에 있는지 고에 있는지 곡에 있는지 알 수 없다. 노랑은 "이 목표 글자를
   * 치는 중"이 아니라 **"지금 조합 중인 실제 문자열"**을 가리켜야 한다.
   */
  const slotContent = (i: number): string => {
    // 포기했으면 가리는 이유가 없다. 이제 알려 주려고 띄운 것이다.
    if (revealed) return chars[i];
    // 초성은 아래 한 줄로 따로 보여 준다. 글자 자리에도 겹쳐 그리면 같은 것이
    // 두 번 보이고, 한 글자만 쳐도 그 자리의 초성이 사라진다.
    if (masked) return typedChars[i] ?? "○";
    if (blind) return typedChars[i] ?? chars[i];
    if (statuses[i] === "wrong" || statuses[i] === "pending")
      return typedChars[i] ?? chars[i];
    return chars[i];
  };

  // key를 바꿔 요소를 다시 붙이는 것으로 애니메이션을 재생한다.
  // 상태와 타이머로 클래스를 껐다 켜는 것보다 어긋날 여지가 없다.
  return (
    <div key={`shake-${erroredAt}`} className={erroredAt > 0 ? "plate-shake" : undefined}>
    {/* plate-area: 표지판과 그 아래 안내를 함께 가리키는 이름 */}
    <div
      key={`pop-${advancedAt}`}
      className={`plate-area relative ${advancedAt > 0 ? "plate-pop" : ""}`}
    >
    <div
      /*
       * 노란 테두리를 뺐다. 노랑은 "지금 풀고 있는 것"만 가리켜야 하는데
       * 지도의 현재 지역·커서·판 테두리 셋이 같은 세기로 주장하면 뜻이 사라진다.
       * 이제 노랑은 지도의 현재 지역과 입력 커서에만 남는다.
       */
      /*
       * 실제 표지판을 따른다.
       *   · 모서리는 크게 굴린다 — 도로표지의 모서리 반경은 판 크기에 비해 크다
       *   · 흰 내곽선은 가장자리에서 한 뼘 들어와 판면을 한 번 더 두른다
       *   · 판면은 평면이다(그라디언트 없음)
       *
       * 폭은 답 길이를 따라가지 않는다. 가린 모드에서 판이 답 길이만큼
       * 늘어나면 글자 수가 공짜로 새는데, 그건 초성 힌트가 5초를 받고 파는
       * 정보다. 그래서 판은 늘 같은 폭이다.
       */
      className={`sign-face relative mx-auto rounded-2xl px-4 py-4 shadow-[0_3px_0_0_var(--color-sign-deep)] transition-opacity sm:px-10 sm:py-6 ${
        /*
         * 답이 이미 보이는 모드에서는 실제 표지판처럼 이름 길이에 맞춘다.
         * 가린 모드에서 그러면 판 너비가 곧 글자 수를 알려 준다 — 초성 힌트가
         * 5초를 받고 파는 정보를 공짜로 주는 셈이다.
         */
        /*
         * 이름 길이에 맞추는 판에서는 오른쪽에 제출 표시가 앉을 자리를
         * 따로 비운다. 비우지 않으면 `서귀포시`처럼 긴 이름이 그 위로 올라탄다.
         * 가린 판은 늘 최대 폭이라 그럴 일이 없다.
         */
        masked
          ? "w-full max-w-2xl"
          : "w-fit min-w-64 max-w-2xl pr-16 sm:min-w-80 sm:pr-28"
      } ${focused ? "" : "opacity-70"}`}
    >
      {/*
        한국 도로표지판 특유의 흰 내곽선. 흐린 회색이 아니라 흰 선이다.
        제출이 거부되면 이 선만 빨개진다 — 판면 전체나 지도를 물들일 일이
        아니다. 틀린 것은 이 한 번의 제출이지 지금까지 온 길이 아니다.
      */}
      <div
        className={`pointer-events-none absolute inset-2 rounded-xl border-2 transition-colors duration-150 sm:inset-2.5 ${
          rejecting ? "border-alert" : "border-paint"
        }`}
      />

      {/*
        제출할 수 있다는 표시.

        저절로 넘어가지 않게 되면서, 첫 문제에서 다 쳐 놓고 아무 일도 일어나지
        않아 멈추는 사람이 생긴다. 다음 동작이 있다는 것을 손이 있는 자리에서
        알려 줘야 한다.

        **맞았는지는 알려 주지 않는다.** 글자가 하나라도 있으면 진해지고 비면
        옅어진다. 정답일 때만 켜면 후보를 하나씩 쳐 보는 것만으로 답을 찾을 수
        있게 되어, 색을 걷어낸 이유가 통째로 무너진다.

        화살표 하나(`›`)로는 부족했다. 다 쳐 놓고 "자동으로 넘어가나?" 하며
        기다리는 사람에게 필요한 말은 **무엇을 눌러야 하는가**이고, 그건
        글자로 적어야 전해진다. 누를 수도 있어야 한다 — 웹에서 눌러 보는 것은
        키를 외우는 것보다 먼저다. 빈 상태에서도 옅게 남겨 두는 이유는,
        칠 것이 있다는 사실 자체가 첫 화면에서 읽혀야 하기 때문이다.

        자리는 absolute라 켜지고 꺼져도 글자가 밀리지 않는다. z-10은 판면을
        덮은 투명 입력창 위로 올리기 위한 것이다 — 없으면 눌러도 입력창이 먹는다.
      */}
      <button
          type="button"
          // 입력창이 포커스를 잃으면 그 뒤로 아무리 쳐도 반응이 없다.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSubmit}
          // 키보드 이동에서는 건너뛴다. Tab은 이 게임에서 힌트 키다.
          tabIndex={-1}
          disabled={!onSubmit}
          aria-label="제출"
          // 흰 내곽선 안쪽에 놓는다. 선 위에 겹치면 표지판이 아니라
          // 인쇄가 밀린 것처럼 보인다.
          className={`absolute top-1/2 right-5 z-10 flex -translate-y-1/2 items-center gap-1.5 rounded-md px-1.5 py-1 font-mono leading-none transition-colors duration-150 sm:right-7 ${
            onSubmit ? "cursor-pointer" : "pointer-events-none"
          } ${typedChars.length > 0 ? "text-paint/90" : "text-paint/40"}`}
        >
          {/* 좁은 화면에는 판 아래 제출 버튼이 따로 있다. 여기서는 기호만. */}
          <span className="hidden text-sm tracking-[0.1em] sm:inline">제출</span>
          <span className="text-xl leading-none sm:text-2xl" aria-hidden="true">
            ↵
          </span>
      </button>

      <div className="relative flex flex-col items-center gap-3">
        {idle ? (
          /*
           * 안내 문구가 글자 줄보다 낮아서, 첫 타건에 판이 세로로 커지고
           * 그 위의 지도까지 밀려 올라갔다. 하필 문제를 보고 손을 움직이는
           * 그 순간에 화면이 흔들린다.
           *
           * 그래서 글자 줄과 **똑같은 구조**를 보이지 않게 한 벌 깔아 높이를
           * 잡아 두고, 문구는 그 위에 겹친다. 높이는 글자 수와 무관하게
           * 폰트와 커서 두께로만 정해지므로 한 글자면 충분하고, 글자 크기를
           * 나중에 바꿔도 두 상태가 저절로 같이 움직인다.
           */
          <div className="relative flex w-full items-center justify-center">
            {/*
              w-full이 없으면 이 상자의 폭이 아래 보이지 않는 한 글자(약 25px)로
              정해지고, 그 안에 absolute로 얹은 안내 문구가 25px 폭에 갇혀
              한 글자씩 세로로 쌓인다. 높이만 빌리고 폭은 판면을 따라야 한다.
            */}
            <div aria-hidden="true" className={`invisible ${CHAR_ROW}`}>
              <span className="relative flex flex-col items-center">
                <span>가</span>
                <span className="mt-1 h-1 w-full rounded-full" />
              </span>
            </div>
            <p className="absolute inset-0 flex items-center justify-center gap-3 whitespace-nowrap text-lg text-paint/70 sm:text-2xl">
              지역명을 입력하세요
              <span
                className={`inline-block h-6 w-0.5 sm:h-8 ${
                  focused ? "animate-pulse bg-centerline" : "bg-transparent"
                }`}
                aria-hidden="true"
              />
            </p>
          </div>
        ) : (
        <div className={CHAR_ROW} aria-label={masked && !revealed ? "지역명" : target}>
          {slots.map((_, i) => (
            <span key={i} className="relative flex flex-col items-center">
              {/*
                초성은 글자 자리 **바로 위에 고정**한다.
                판 밖에 한 줄로 떼어 놓았더니 `ㄴ ㄷ`가 무엇을 뜻하는지
                연결되지 않았고, 글자 자리에 겹쳐 그렸더니 한 글자만 쳐도
                입력이 덮어 버렸다. 위에 두면 둘 다 아니다.

                맞힌 글자의 초성만 흐려진다. 지워지지 않는 이유: 틀린 순간에
                힌트가 사라지면 정작 필요할 때 없다. `님`이라고 잘못 쳤어도
                첫 글자가 ㄴ이라는 사실은 계속 보여야 한다.
              */}
              {showHint && (
                <span
                  aria-hidden="true"
                  // 글자의 절반쯤. 더 작으면 장식처럼 보여 힌트라는 사실
                  // 자체가 안 읽힌다.
                  className={`mb-1 font-mono text-xl leading-none transition-opacity duration-200 sm:text-3xl ${
                    statuses[i] === "correct"
                      ? "text-paint/25"
                      : "text-centerline/80"
                  }`}
                >
                  {hintInitials[i]}
                </span>
              )}
              <span
                className={`${
                  /*
                   * 공개된 정답은 노랑이다 — 맞힌 것처럼 하얗게 두면 방금
                   * 포기한 것과 구분이 안 된다. 다만 따라 친 글자는 하얗게
                   * 채워진다. 어디까지 썼는지가 그 자리에서 보여야 한다.
                   */
                  /*
                   * 거부된 제출은 통째로 빨갛다. 어느 글자가 틀렸는지는
                   * 여전히 말하지 않는다 — 그걸 짚어 주면 한 글자씩 바꿔
                   * 보는 것만으로 답이 나온다.
                   */
                  rejecting && typedChars[i] !== undefined
                    ? "text-alert"
                    : revealed
                      ? statuses[i] === "correct"
                        ? "text-paint"
                        : "text-centerline"
                      : blind
                        ? typedChars[i] === undefined
                          ? CHAR_TONE.untyped
                          : "text-paint"
                        : CHAR_TONE[statuses[i]]
                } transition-colors duration-100`}
              >
                {slotContent(i)}
              </span>
              {/* 지금 칠 차례인 글자 아래에만 커서를 둔다 */}
              <span
                className={`mt-1 h-1 w-full rounded-full transition-opacity ${
                  i === cursor && focused ? "bg-centerline opacity-100" : "opacity-0"
                }`}
              />
            </span>
          ))}
          {/*
            길이를 숨기는 동안에는 다음 칸이 없다. 커서를 놓을 자리도 없으므로
            친 글자 뒤에 한 칸을 따로 둔다 — 여기가 다음에 찍힐 자리라는 것이
            보여야 입력이 살아 있다는 감각이 생긴다.
          */}
          {lengthHidden && (
            <span aria-hidden="true" className="relative flex flex-col items-center">
              {/* 높이만 빌린다. 폭은 커서 하나만큼이면 된다. */}
              <span className="invisible w-0">가</span>
              <span
                className={`mt-1 h-1 w-3 rounded-full transition-opacity sm:w-4 ${
                  focused ? "bg-centerline opacity-100" : "opacity-0"
                }`}
              />
            </span>
          )}
          {/* 넘겨 친 글자도 그려야 몇 자를 지워야 하는지 눈으로 보인다. */}
          {extra.map((ch, i) => (
            <span key={`extra-${i}`} className="relative flex flex-col items-center">
              {/* 길이를 넘겼다는 것도 정보다. 제출 전에는 알려 주지 않는다. */}
              <span className={blind ? "text-paint" : "text-alert"}>{ch}</span>
              <span className="mt-1 h-1 w-full rounded-full opacity-0" />
            </span>
          ))}
        </div>
        )}

        {/*
          로마자. 실제 도로표지의 가장 큰 특징이고, 한글 바로 아래 같은 자리에
          온다. 이름이 보이는 상황에서만 적는다 — 가린 모드에서 로마자는 답이다.
        */}
        {roman && (!masked || revealed) && (
          <span
            className={`font-mono text-sm tracking-[0.12em] sm:text-base ${
              revealed ? "text-centerline/80" : "text-paint/75"
            }`}
          >
            {roman}
          </span>
        )}
      </div>
    </div>

    {/*
      판 아래 안내.
      늘 자리를 비워 두면(min-height) 아무 일도 없는 동안 36px이 그냥 빈다.
      겹쳐 두면 자리를 먹지 않으면서, 뜰 때 지도나 판이 밀리지도 않는다.
    */}
    <div className="pointer-events-none absolute top-full right-0 left-0 mt-2 flex flex-col items-center gap-1">
      {revealed && (
        <span className="font-mono text-sm text-dim" role="status">
          오답노트에 담았습니다
        </span>
      )}

      {extra.length > 0 && !blind && (
        <span className="font-mono text-sm text-alert" role="status">
          {extra.length}자 더 쳤습니다 — 지우세요
        </span>
      )}
    </div>
    </div>
    </div>
  );
}

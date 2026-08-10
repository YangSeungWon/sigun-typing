import { readText, writeText } from "./storage";

/**
 * 아주 짧은 소리.
 *
 * 정답의 손맛은 화면만으로 다 만들어지지 않는다. 다만 이 게임에 필요한 것은
 * 배경음악이나 효과음 세트가 아니라 "맞았다"를 알리는 20분의 1초짜리 신호다.
 * 그래서 음원 파일을 싣지 않고 그 자리에서 소리를 만든다 — 받을 것도, 캐시할
 * 것도, 늦게 뜰 것도 없다.
 *
 * 오답에 부저를 울리지 않는다. 회상 게임에서 틀리는 것은 실패가 아니라
 * 과정이고, 매번 혼나는 소리가 나면 그만두게 된다.
 */

const KEY = "sigun:sound:v1";

let context: AudioContext | null = null;

/** 켜져 있는가. 저장된 값이 없으면 켜 둔다 — 소리가 아주 작고 짧다. */
export function soundOn(): boolean {
  return readText(KEY) !== "off";
}

export function setSoundOn(on: boolean): void {
  writeText(KEY, on ? "on" : "off");
}

/**
 * 소리를 낼 수 있는 상태로 만든다.
 *
 * 브라우저는 사용자가 뭔가 누르기 전에는 소리를 못 내게 막는다. 출발을
 * 누르는 순간이 그 첫 동작이므로 거기서 한 번 깨워 둔다.
 */
export function primeSound(): void {
  if (typeof window === "undefined" || context) return;
  try {
    context = new AudioContext();
    void context.resume();
  } catch {
    // 오디오를 못 쓰는 환경. 게임은 그대로 돌아간다.
  }

  /*
   * 판이 알아서 시작하므로 이 페이지에서 아무것도 누르지 않았을 수 있고,
   * 그러면 브라우저가 소리를 막아 둔 상태다. 첫 타건이 들어오는 순간 깨운다.
   */
  if (context && context.state === "suspended") {
    const wake = () => void context?.resume();
    window.addEventListener("keydown", wake, { once: true });
    window.addEventListener("pointerdown", wake, { once: true });
  }
}

/**
 * @param freq 음높이(Hz). 두 개를 주면 그 사이를 미끄러진다.
 * @param ms 길이
 * @param gain 세기. 기본값이 작다 — 조용한 방에서 놀 수도 있다.
 * @param delayMs 이만큼 뒤에 낸다. setTimeout보다 정확하다 — 오디오 시계로 잰다.
 */
function blip(
  freq: number | [number, number],
  ms: number,
  gain = 0.05,
  delayMs = 0,
): void {
  if (!context || !soundOn()) return;
  try {
    const osc = context.createOscillator();
    const amp = context.createGain();
    // 사인파. 사각파는 이 길이에서도 귀에 거슬린다.
    osc.type = "sine";

    const at = context.currentTime + delayMs / 1000;
    const dur = ms / 1000;
    if (Array.isArray(freq)) {
      osc.frequency.setValueAtTime(freq[0], at);
      osc.frequency.exponentialRampToValueAtTime(freq[1], at + dur);
    } else {
      osc.frequency.setValueAtTime(freq, at);
    }

    // 딸깍 소리가 나지 않도록 아주 짧게 올렸다 내린다.
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(gain, at + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(amp).connect(context.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  } catch {
    // 소리가 안 나는 것이 게임을 막을 이유는 없다.
  }
}

/*
 * 음높이는 오음계(펜타토닉)에서 고른다.
 *
 * 소리가 연달아 나는 게임이라 아무 음이나 쓰면 빨리 칠수록 불협이 된다.
 * 반음이 없는 음계에서는 어떤 순서로 나와도 부딪히지 않는다.
 */
const SCALE = [660, 740, 880, 990, 1110, 1320, 1480];

/**
 * 한 곳 맞혔다 — 띠링.
 *
 * @param streak 연속 무오타 수. 이어 갈수록 한 음씩 올라간다. 같은 소리가
 *   스무 번 반복되면 그건 신호가 아니라 소음이 되고, 무엇보다 잘하고 있다는
 *   것이 귀로도 들려야 한다. 오타가 나면 제자리로 돌아온다 — 벌점을 주는
 *   대신 올라가던 것이 멈추는 쪽이 이 게임의 성격에 맞는다.
 */
export function playCorrect(streak = 0): void {
  blip(SCALE[Math.min(streak, SCALE.length - 1)], 90);
}

/** 카운트다운 한 칸. 낮고 짧게 — 아직 시작이 아니라는 뜻이다. */
export function playTick(): void {
  blip(440, 60, 0.04);
}

/** 출발. 카운트다운보다 한 옥타브 위로 올라간다. */
export function playStart(): void {
  blip([660, 880], 160, 0.055);
}

/**
 * 초성을 열었다. 내려가는 두 음 — 도움을 받았다는 것은 알되
 * 혼내는 소리로는 들리지 않아야 한다.
 */
export function playHint(): void {
  blip(590, 70, 0.035);
  blip(495, 90, 0.035, 80);
}

/**
 * 답을 냈는데 틀렸다.
 *
 * 부저를 울리지 않는다. 회상 게임에서 틀리는 것은 실패가 아니라 과정이고,
 * 매번 혼나는 소리가 나면 그만두게 된다. 짧게 두 번 두드리는 정도 —
 * "그건 아니야, 다시"에 해당하는 소리다. 포기 소리보다는 높다.
 */
export function playWrong(): void {
  blip(494, 55, 0.04);
  blip(494, 70, 0.04, 70);
}

/** 모르겠다고 넘겼다. 힌트보다 더 내려간다. */
export function playGiveUp(): void {
  blip(400, 90, 0.035);
  blip([330, 260], 160, 0.035, 90);
}

/** 남은 시간이 얼마 없다. 초마다 한 번, 정답 소리와 겹치지 않게 낮다. */
export function playUrgent(): void {
  blip(330, 70, 0.045);
}

/** 코스를 다 채웠다. 맞힘 소리보다 길고 위로 열린다. */
export function playComplete(): void {
  blip(660, 120);
  blip(990, 220, 0.05, 110);
}

/** 내 최고 기록을 갈아 치웠다. 완주 소리 위에 한 음 더 얹는다. */
export function playRecord(): void {
  blip(880, 110, 0.05);
  blip(1110, 110, 0.05, 100);
  blip(1320, 320, 0.055, 200);
}

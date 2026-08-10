import { readText, writeText } from "./storage";

/**
 * 아주 짧은 소리.
 *
 * 정답의 손맛은 화면만으로 다 만들어지지 않는다. 다만 이 게임에 필요한 것은
 * 배경음악이나 효과음 세트가 아니라 "맞았다"를 알리는 20분의 1초짜리 신호다.
 * 그래서 음원 파일을 싣지 않고 그 자리에서 소리를 만든다 — 받을 것도, 캐시할
 * 것도, 늦게 뜰 것도 없다.
 *
 * 오답에는 소리를 내지 않는다. 회상 게임에서 틀리는 것은 실패가 아니라
 * 과정이고, 매번 부저가 울리면 그만두게 된다.
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
 * @param freq 음높이(Hz)
 * @param ms 길이
 * @param gain 세기. 기본값이 작다 — 조용한 방에서 놀 수도 있다.
 */
function blip(freq: number, ms: number, gain = 0.05): void {
  if (!context || !soundOn()) return;
  try {
    const osc = context.createOscillator();
    const amp = context.createGain();
    // 사인파. 사각파는 이 길이에서도 귀에 거슬린다.
    osc.type = "sine";
    osc.frequency.value = freq;

    const now = context.currentTime;
    // 딸깍 소리가 나지 않도록 아주 짧게 올렸다 내린다.
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);

    osc.connect(amp).connect(context.destination);
    osc.start(now);
    osc.stop(now + ms / 1000 + 0.02);
  } catch {
    // 소리가 안 나는 것이 게임을 막을 이유는 없다.
  }
}

/** 한 곳 맞혔다. */
export function playCorrect(): void {
  blip(880, 90);
}

/** 코스를 다 채웠다. 맞힘 소리보다 조금 길고 한 음 위다. */
export function playComplete(): void {
  blip(660, 120);
  setTimeout(() => blip(990, 220), 110);
}

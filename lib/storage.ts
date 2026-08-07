/**
 * 기기에 남기는 값들의 유일한 출입구.
 *
 * 오답노트·개인 기록·기기 식별자·닉네임이 각자 localStorage를 직접 만지고
 * 있었고, 넷 다 같은 방어 코드를 따로 갖고 있었다 — 서버에는 없다, 사생활
 * 보호 모드에서는 쓰기가 막힌다, 남이 고쳐 놨을 수 있다. 한 군데서만 틀려도
 * 게임이 통째로 죽는 종류의 코드라 한곳에 모은다.
 *
 * 규칙 하나: **저장소 실패는 절대 게임을 멈추지 않는다.** 기록을 못 남기는
 * 것은 아쉬운 일이고, 그것 때문에 못 노는 것은 망가진 것이다.
 */

/*
 * 키 이름은 각 기능이 정한다. 다만 두 가지는 공통이다 —
 * `sigun:`으로 시작하고, 저장 형식의 판번호를 키 안에 넣는다.
 * 형식이 바뀌면 옛 값을 옮기는 대신 못 본 척한다. 남는 건 몇 바이트고,
 * 잘못 읽은 옛 값은 틀린 기록이다.
 */

/** 지금 이 환경에서 저장소를 쓸 수 있는지. 서버 렌더와 사생활 보호 모드를 함께 거른다. */
function store(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    // 일부 브라우저는 접근 자체에서 예외를 던진다.
    return null;
  }
}

export function readText(k: string): string | null {
  return store()?.getItem(k) ?? null;
}

export function writeText(k: string, value: string): boolean {
  try {
    store()?.setItem(k, value);
    return store() !== null;
  } catch {
    return false;
  }
}

/**
 * JSON을 읽고 검사한다.
 *
 * `accept`를 반드시 통과해야 한다. localStorage 값은 사용자가 직접 고칠 수
 * 있으므로 신뢰할 수 없는 입력이고, 모양이 어긋난 값을 그대로 흘려보내면
 * 화면이 아니라 게임 도중에 터진다.
 */
export function readJson<T>(k: string, accept: (raw: unknown) => T | null): T | null {
  const raw = readText(k);
  if (raw === null) return null;
  try {
    return accept(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeJson(k: string, value: unknown): boolean {
  try {
    return writeText(k, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function remove(k: string): void {
  try {
    store()?.removeItem(k);
  } catch {
    // 지우지 못해도 할 수 있는 일이 없다.
  }
}

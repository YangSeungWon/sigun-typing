"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsHydrated } from "@/lib/useIsHydrated";

interface Row {
  id: string;
  nickname: string;
  deviceId: string;
  courseId: string;
  mode: string;
  completed: number;
  total: number;
  elapsedMs: number;
  createdAt: string;
  hiddenAt: string | null;
  hiddenReason: string | null;
}

/**
 * 열쇠를 어디에 두는가.
 *
 * 주소에 실으면(`?token=`) 브라우저 방문 기록과 리퍼러에 남는다. 그래서 화면이
 * 한 번 물어보고 이 기기에만 둔다. 서버로는 늘 헤더로만 간다.
 */
const KEY = "sigun:admin-token";

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

/**
 * 최근 올라온 이름 목록.
 *
 * 기록이 아니라 **이름을 보는 화면**이다. 그래서 이름이 제일 크고, 초와 완주
 * 수는 뒤에 작게 붙는다 — 여기서 그 숫자들은 "이 줄이 진짜 판인가"를 가늠하는
 * 곁가지일 뿐이다.
 */
export function AdminNames() {
  const [token, setToken] = useState("");
  const [typed, setTyped] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  /*
   * 저장해 둔 열쇠는 하이드레이션 뒤에 한 번만 읽는다. 서버는 localStorage를
   * 모르므로 첫 렌더는 없는 상태로 그려야 서버가 그린 것과 어긋나지 않는다.
   */
  const hydrated = useIsHydrated();
  const [read, setRead] = useState(false);
  if (hydrated && !read) {
    setRead(true);
    setToken(localStorage.getItem(KEY) ?? "");
  }

  /*
   * 상태는 전부 `await` 뒤에서만 건드린다. 이펙트 본문에서 바로 setState를
   * 하면 그 렌더가 끝나기 전에 다시 그려진다.
   */
  const load = useCallback(async (key: string) => {
    try {
      const res = await fetch("/api/admin/recent?limit=200", {
        headers: { "x-admin-token": key },
        cache: "no-store",
      });
      if (!res.ok) {
        // 404가 곧 "열쇠가 틀렸다"이다. 서버는 문이 있다는 것도 안 알려 준다.
        setError("열쇠가 맞지 않습니다");
        setRows(null);
        return;
      }
      const body = (await res.json()) as { rows: Row[] };
      setRows(body.rows);
      setError(null);
    } catch {
      setError("불러오지 못했습니다");
    }
  }, []);

  useEffect(() => {
    /*
     * 열쇠가 생기면 가져온다. 규칙이 이펙트 안의 setState를 막는데, 여기서
     * 하는 일은 바깥에서 값을 받아 오는 것이고 그건 이펙트가 하라고 있는
     * 일이다. 상태는 전부 `await` 뒤에서만 바뀐다.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) void load(token);
  }, [token, load]);

  /**
   * 숨긴다 — 지우지 않는다.
   *
   * 한때 `내리기`라고 불렀다. 내리는 것은 받는 것일 수도, 낮추는 것일 수도
   * 있어서 무슨 일이 일어나는지가 안 정해진다. 하는 일은 정확히 숨기는
   * 것이고(`hidden_at`), 그 말은 반대말도 바로 나온다.
   *
   * 몇 줄이 걸리는지 먼저 세어 보여 준다. `이 기기 전부`는 코스와 모드를
   * 가리지 않고 걸리므로, 누르는 사람이 그 크기를 모르고 누르면 안 된다.
   */
  const hide = async (target: { id?: string; deviceId?: string }, label: string) => {
    const n = target.deviceId
      ? (rows ?? []).filter((r) => r.deviceId === target.deviceId && !r.hiddenAt).length
      : 1;
    const reason = window.prompt(`${label} ${n}줄을 숨깁니다\n왜 숨기는지 적으세요`, "욕설");
    if (!reason) return;
    setBusy(target.id ?? target.deviceId ?? null);
    try {
      const res = await fetch("/api/admin/hide", {
        method: "POST",
        headers: { "x-admin-token": token, "content-type": "application/json" },
        body: JSON.stringify({ ...target, reason }),
      });
      if (!res.ok) setError("숨기지 못했습니다");
      else await load(token);
    } finally {
      setBusy(null);
    }
  };

  if (!token) {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const key = typed.trim();
          if (!key) return;
          localStorage.setItem(KEY, key);
          setToken(key);
        }}
      >
        <h1 className="text-2xl font-semibold">닉네임 훑기</h1>
        {/* 서버가 무슨 값을 기다리는지 그대로 적는다. 이건 도구다. */}
        <input
          type="password"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="ADMIN_TOKEN"
          className="rounded-lg border border-edge bg-paint px-4 py-3 font-mono"
        />
        <button
          type="submit"
          className="w-fit rounded-lg bg-sign px-5 py-3 font-medium text-on-sign"
        >
          열기
        </button>
      </form>
    );
  }

  return (
    <>
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">닉네임 훑기</h1>
        <span className="flex gap-3 font-mono text-sm text-dim">
          <button type="button" onClick={() => void load(token)} className="hover:text-ink">
            새로고침
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(KEY);
              setToken("");
              setRows(null);
            }}
            className="hover:text-ink"
          >
            {/*
              `열쇠 지우기`였다. 토큰을 무효로 만든다는 뜻으로 읽힌다 — 하는
              일은 이 브라우저에 둔 것을 지우고 다시 물어보는 것뿐이다.
            */}
            잠그기
          </button>
        </span>
      </header>

      {error && <p className="font-mono text-sm text-alert">{error}</p>}

      <ul className="flex flex-col divide-y divide-edge">
        {rows?.map((row) => (
          <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
            {/*
              숨긴 줄도 남긴다. 빼면 방금 숨긴 것이 사라져서 눌렸는지 알 수
              없고, 같은 기기가 다시 올리는지도 안 보인다.
            */}
            <span
              className={`text-lg font-medium ${row.hiddenAt ? "text-dim line-through" : ""}`}
            >
              {row.nickname}
            </span>
            <span className="font-mono text-sm text-dim">
              {row.courseId} {row.completed}/{row.total}
            </span>
            <span className="font-mono text-sm text-dim">{ago(row.createdAt)}</span>
            <span className="font-mono text-xs text-dim/70">
              {row.deviceId.slice(0, 8)}
            </span>

            {row.hiddenAt ? (
              <span className="font-mono text-xs text-alert">숨김 {row.hiddenReason}</span>
            ) : (
              /* 숨기는 단추는 오른쪽 끝에 모은다. 이름을 읽는 눈길과 안 겹친다. */
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void hide({ id: row.id }, row.nickname)}
                  className="rounded-md border border-edge px-3 py-1 font-mono text-xs hover:bg-concrete-deep disabled:opacity-40"
                >
                  {/*
                    `이 줄`이었다. 무엇을 하는 단추인지가 이름에 없어서 눌러
                    봐야 알았다. 동사를 준다 — 이 화면에서 하는 일은 하나뿐이다.
                  */}
                  이 줄 숨기기
                </button>
                {/*
                  한 사람이 여러 줄을 도배했을 때 한 줄씩 누르는 것은 손해다.
                */}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void hide({ deviceId: row.deviceId }, `${row.nickname}의 기기에서`)}
                  className="rounded-md border border-alert/40 px-3 py-1 font-mono text-xs text-alert hover:bg-alert/10 disabled:opacity-40"
                >
                  이 기기 전부 숨기기
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {rows?.length === 0 && <p className="text-dim">아직 올라온 기록이 없습니다.</p>}
    </>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * 화면이 죽었을 때.
 *
 * 두 가지를 한다. 사용자에게는 다음에 할 수 있는 일을 주고, 운영자에게는
 * 무슨 일이 났는지 보낸다. 보고가 없으면 브라우저에서 죽는 종류의 고장은
 * 서버 로그에 아무 흔적도 남기지 않아 영영 모른다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        // 질의 문자열은 빼고 보낸다. 도전장 링크에는 닉네임이 실려 있다.
        path: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {
      // 보고가 실패해도 사용자는 이미 이 화면을 보고 있다.
    });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      {/*
        제목과 단추뿐이다. `무슨 일이 났는지는 저희에게 전달되었습니다`는
        사용자가 할 일이 없는 정보이고, 그 뒤는 위로와 부탁이다. 여기서
        할 수 있는 일은 아래 단추 둘이 이미 말한다.
      */}
      <h1 className="text-4xl font-bold">화면이 멈췄습니다</h1>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-sign px-5 py-3 font-medium text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="rounded-lg border border-edge px-5 py-3 font-medium text-ink transition-colors hover:bg-concrete-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          처음으로
        </Link>
      </div>
      {error.digest && (
        // 문의가 왔을 때 서버 로그와 맞춰 보는 열쇠다.
        <p className="font-mono text-xs text-dim">오류 번호 {error.digest}</p>
      )}
    </main>
  );
}

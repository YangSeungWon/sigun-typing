"use client";

import { io, type Socket } from "socket.io-client";

/**
 * 소켓 서버 주소.
 *
 * 운영에서는 Caddy가 같은 도메인의 /socket.io/ 를 소켓 서버로 넘기므로
 * 주소를 따로 심을 필요가 없다. 이건 편의가 아니라 필요다 —
 * NEXT_PUBLIC_* 값은 **빌드 시점에 번들에 박히기** 때문에, 도메인을 거기 넣으면
 * 도메인이 바뀔 때마다 이미지를 다시 빌드해야 한다.
 *
 * 로컬에서 소켓만 다른 포트로 띄울 때만 NEXT_PUBLIC_SOCKET_URL로 덮어쓴다.
 */
export function socketUrl(): string {
  const override = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (override) return override;
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function connectSocket(): Socket {
  return io(socketUrl(), {
    // 폴링을 거치지 않고 바로 웹소켓으로 붙는다. 경주 중 지연이 곧 순위다.
    transports: ["websocket"],
    // 리버스 프록시 뒤에서도 경로는 그대로 /socket.io/ 다.
    path: "/socket.io/",
  });
}

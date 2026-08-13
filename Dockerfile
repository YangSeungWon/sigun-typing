# 이미지 하나에서 두 서비스를 뽑는다 — Next 웹과 소켓 서버.
# 규칙 코드(lib/, data/)를 둘이 공유하므로 저장소를 쪼개지 않는 편이 낫다.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
# sitemap.xml·robots.txt의 절대 주소는 빌드 시점에 박힌다.
ARG SITE_URL=https://sigun-typing.ysw.kr
ENV SITE_URL=$SITE_URL
# 화면 판번호. 이벤트마다 함께 저장돼, 화면을 고치면서도 숫자를 가를 수 있게 한다.
ARG UI_REVISION=dev
ENV NEXT_PUBLIC_UI_REVISION=$UI_REVISION
# 빌드 시점에는 DB가 없다 — compose 네트워크는 아직 없고, 있어도 붙을 이유가 없다.
#
# 코스 목록은 1위를 곁들여 그리므로 미리 만들어 두는 페이지이면서 DB를 부른다.
# 그래서 값을 비워 두면 안 된다: DATABASE_URL이 없으면 getScoreRepository가
# **동기로** 예외를 던지는데(운영에서 조용히 메모리 저장소로 뜨는 것을 막는
# 장치다) 페이지의 .catch는 프로미스만 잡으므로 빌드가 통째로 죽는다.
#
# 닿지 않는 주소를 준다. 그러면 연결 실패가 프로미스 거절로 와서 .catch가
# 받고, 페이지는 의도된 대로 1위 없이 그려진다. 뜬 뒤 첫 재검증(60초)에
# 진짜 값이 채워진다. 런타임 주소는 compose가 넣으므로 이 값은 남지 않는다.
ARG BUILD_DATABASE_URL=postgres://build:build@127.0.0.1:1/none
ENV DATABASE_URL=$BUILD_DATABASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec next build

# 웹: standalone 산출물만 담아 가볍게 간다.
FROM base AS web
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

# 소켓과 마이그레이션: tsx와 drizzle-kit이 필요해 node_modules를 통째로 쓴다.
FROM base AS socket
ENV NODE_ENV=production
ENV SOCKET_PORT=4000
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY server ./server
# 퍼널 조회 등 운영 중에 돌리는 스크립트
COPY scripts ./scripts
COPY lib ./lib
COPY data ./data
EXPOSE 4000
CMD ["node_modules/.bin/tsx", "server/index.mts"]

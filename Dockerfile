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
# 같은 값을 배포 판번호로도 쓴다 — 옛 탭이 새 서버를 만나면 통째로 새로고침한다.
ENV NEXT_DEPLOYMENT_ID=$UI_REVISION
# DATABASE_URL은 일부러 주지 않는다.
#
# 빌드 시점에 DB가 없는 것은 고장이 아니라 정상이다. 코스 목록은 1위를
# 곁들여 그리므로 미리 만들어 두면서 DB를 부르는데, 없으면 없는 대로
# 1위 없이 그려지고 뜬 뒤 첫 재검증(60초)에 채워진다 — 그 저하 경로는
# lib/db/client.ts가 책임진다.
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

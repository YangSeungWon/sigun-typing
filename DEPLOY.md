# 배포

이미 있는 리버스 프록시 뒤에 붙이는 것을 전제로 한다. TLS와 도메인은 프록시가 맡고,
이쪽은 로컬 포트 두 개만 연다.

## 포트

| 서비스 | 컨테이너 | 호스트 기본값 | 프록시에서 보낼 경로 |
| --- | --- | --- | --- |
| web | 3000 | `127.0.0.1:18730` | `/` (나머지 전부) |
| socket | 4000 | `127.0.0.1:18731` | `/socket.io/` |
| db | 5432 | **열지 않음** | — |

포트는 `.env`의 `WEB_PORT` / `SOCKET_PORT`로 바꾼다.
프록시가 다른 호스트에 있으면 `BIND_ADDR=0.0.0.0`으로 바꾸고 방화벽으로 막는다.

Postgres는 호스트에 포트를 열지 않는다. compose 네트워크 안에서만 붙으므로
바깥에서 접근할 방법이 없다.

## 프록시에서 꼭 맞춰야 하는 것

**소켓을 별도 서브도메인으로 빼지 않았다.** 같은 도메인의 `/socket.io/` 를 소켓 서버로
보내는 구조라, DNS 레코드도 인증서도 하나로 끝나고 브라우저가 같은 오리진으로
붙으므로 CORS 자체가 없다.

대신 `/socket.io/` 경로를 **web보다 먼저** 매칭해야 하고, 웹소켓 업그레이드를
넘겨야 한다. nginx는 이걸 명시적으로 적어 줘야 한다 — 안 적으면 폴링으로만
붙거나 연결이 계속 끊긴다.

### nginx

`http { }` 안에 map을 하나 둔다. 폴링 요청에는 `Upgrade` 헤더가 없는데
`Connection: upgrade`를 늘 보내면 업스트림이 헷갈린다. 웹소켓과 폴링이
같은 location을 쓰므로 이게 필요하다.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name sigun-typing.ysw.kr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name sigun-typing.ysw.kr;

    # certbot --nginx 를 쓰면 이 두 줄은 certbot이 넣어 준다.
    ssl_certificate     /etc/letsencrypt/live/sigun-typing.ysw.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sigun-typing.ysw.kr/privkey.pem;

    # nginx는 접두사 location 중 **가장 긴 것**을 고른다. 파일에서의 순서는
    # 상관없다(순서가 중요한 건 정규식 location이다). 그래서 /socket.io/ 가
    # 언제나 / 보다 먼저 잡힌다.
    #
    # 이미 쓰던 프록시가 있다면 아래 두 줄(Upgrade·Connection)이 그쪽 공통
    # 스니펫에 들어 있는지 먼저 보라. 아래 "웹소켓이 400으로 끊길 때" 참고.
    location /socket.io/ {
        proxy_pass http://127.0.0.1:18731;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 경주 중에도 아무도 안 치는 구간이 있다. 기본 60초면 그때 끊긴다.
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        # 실시간 전송을 모아 두면 순위 표시가 밀린다.
        proxy_buffering off;
    }

    location / {
        proxy_pass http://127.0.0.1:18730;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 내용이 바뀌면 파일명이 바뀌므로 길게 캐시해도 안전하다.
    location /_next/static/ {
        proxy_pass http://127.0.0.1:18730;
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### 웹소켓이 400으로 끊길 때

폴링은 되는데 웹소켓만 `400 Invalid Upgrade header`로 끊긴다면, 십중팔구
**같은 헤더를 두 번 보내고 있다.**

```
Upgrade: websocket, websocket
```

nginx는 `proxy_set_header`를 같은 이름으로 두 번 적으면 합치지 않고 두 번
보낸다. 이미 쓰던 서버에 붙일 때 흔하다 — 공통 스니펫이 이미 업그레이드
헤더를 넣고 있는데 위 블록을 그대로 복사해 붙이면 그렇게 된다.

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:18731;
    include /etc/nginx/snippets/proxy-common.conf;   # 여기서 이미 넣는다면
    proxy_set_header Upgrade $http_upgrade;          # ← 이 두 줄은 빼야 한다
    proxy_set_header Connection $connection_upgrade; # ←
}
```

확인은 이렇게 한다.

```bash
curl -i --http1.1 -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://sigun-typing.ysw.kr/socket.io/?EIO=4&transport=websocket"
```

`101 Switching Protocols`가 나와야 한다. 소켓 포트로 직접 쏘면 101인데 도메인으로
쏠 때만 400이면 프록시 쪽 문제다.

브라우저에서는 `방 만들기` 버튼이 계속 비활성인 것으로 드러난다 — 연결되지
않으면 누를 수 없게 되어 있다.

### Caddy

업그레이드 헤더를 알아서 넘기므로 이게 전부다.

```caddy
sigun-typing.ysw.kr {
	handle /socket.io/* {
		reverse_proxy 127.0.0.1:18731
	}
	handle {
		reverse_proxy 127.0.0.1:18730
	}
}
```

### Traefik

`/socket.io/` 라우터의 우선순위를 기본 라우터보다 높게 준다.

## DNS

**A 레코드 하나면 끝난다.**

```
sigun-typing.ysw.kr.   A   <리버스 프록시가 도는 서버의 공인 IPv4>   TTL 300
```

- `quiz-korea.ysw.kr`와 같은 서버에 올린다면 **그 레코드와 같은 IP**를 쓴다.
- `*.ysw.kr` 와일드카드 A 레코드가 이미 있다면 **DNS는 아무것도 안 해도 된다.**
  프록시에 server 블록만 추가하면 된다.
- IPv6로도 서비스한다면 `AAAA` 레코드를 같은 이름으로 하나 더 둔다.
- 소켓용 레코드는 필요 없다. 같은 도메인을 쓴다.
- Cloudflare를 프록시(주황 구름)로 쓴다면 웹소켓은 그대로 동작한다. 다만
  프록시 서버에서 Let's Encrypt HTTP-01 갱신을 한다면 충돌하므로 DNS-01로 바꾸거나
  회색 구름으로 둔다.
- TTL은 옮길 가능성이 남아 있는 동안 300초로 두고, 안정되면 늘린다.

## 올리기

```bash
cp .env.example .env
# SCORE_SECRET, POSTGRES_PASSWORD, APP_ORIGIN 채우기
openssl rand -base64 32     # SCORE_SECRET
```

```bash
docker compose build
docker compose up -d
```

`migrate` 컨테이너가 스키마를 맞추고 빠진 뒤에 web이 뜬다. 순서는 compose가 지킨다.

> **`POSTGRES_PASSWORD`는 반드시 첫 기동 전에 정해 둘 것.**
> Postgres는 이 값을 **볼륨을 처음 만들 때만** 반영한다. 이미 뜬 뒤에 `.env`에서
> 바꾸면 볼륨 안의 비밀번호는 그대로라 `migrate`가 `28P01 password authentication
> failed`로 죽는다. 게다가 drizzle-kit이 이 에러를 삼켜서 exit 1만 남기므로
> 원인이 잘 안 보인다. 이미 어긋났다면 볼륨을 지우고(`docker compose down -v`,
> **기록도 함께 사라진다**) 다시 올리거나, DB에서 직접 `ALTER ROLE`로 맞춘다.

확인:

```bash
curl -sS localhost:18730/ -o /dev/null -w '%{http_code}\n'   # 200
curl -sS localhost:18731/health                              # {"ok":true,...}
```

프록시까지 연결한 뒤:

```bash
curl -sS https://sigun-typing.ysw.kr/ -o /dev/null -w '%{http_code}\n'
curl -sS "https://sigun-typing.ysw.kr/socket.io/?EIO=4&transport=polling" | head -c 60
```

두 번째가 `0{"sid":...` 로 시작하면 소켓 경로가 제대로 붙은 것이다.

## 환경변수에서 조심할 것

- `SCORE_SECRET`은 **web과 socket이 같은 값**이어야 한다. 소켓 서버가 발급한
  토큰을 web이 검증하기 때문이다. 다르면 멀티플레이 기록이 전부 `bad_token`으로
  거부된다.
- `APP_ORIGIN`은 실제 서비스 주소와 정확히 같아야 한다. **비워 두면 안 된다** —
  compose 기본값(`http://localhost:18730`)이 들어가고, 소켓 서버가 브라우저의
  출처(`https://…`)를 거부해 멀티가 통째로 붙지 않는다. 증상은 아래
  "웹소켓이 400으로 끊길 때"와 같아 보이지만 원인이 다르다: 이쪽은
  `docker compose exec socket printenv APP_ORIGIN`으로 바로 확인된다.
- `NEXT_PUBLIC_SOCKET_URL`은 **비워 둔다.** 비어 있으면 브라우저가 현재 오리진으로
  붙는다. 여기에 도메인을 넣으면 그 값이 빌드 시점에 번들에 박혀서, 도메인을
  바꿀 때마다 이미지를 다시 빌드해야 한다.
- `DATABASE_URL` 없이 뜨면 운영에서는 예외를 던진다. 조용히 메모리 저장소로
  떠서 기록이 사라지는 일을 막기 위한 것이다.

## 백업

`backup` 컨테이너가 알아서 돈다. 하루 한 번 `pg_dump`를 떠서 `./backups`에
`sigun-<날짜>.sql.gz`로 남기고, 14일이 지난 것은 지운다.

코드도 지역 자료도 저장소에서 되살릴 수 있지만 **남이 남긴 기록만은
되살릴 수 없다.** `docker compose down -v` 한 번이면 사라지는 자리라
사람 손에 맡기지 않는다.

```bash
docker compose logs backup --tail 5   # 마지막 회차 확인
ls -lh backups/
```

| 환경변수 | 기본값 | |
| --- | --- | --- |
| `BACKUP_DIR` | `./backups` | 덤프를 둘 곳 |
| `BACKUP_RETAIN_DAYS` | `14` | 이보다 오래된 덤프는 지운다 |
| `BACKUP_INTERVAL_SECONDS` | `86400` | 회차 간격 |

### 서버 밖으로 한 벌 더

`./backups`는 **같은 디스크에 있다.** `down -v`와 실수 삭제는 막지만 디스크가
통째로 죽으면 백업도 함께 사라진다. 여기까지 해 둬야 진짜 백업이다.

```bash
OFFSITE_DEST=/mnt/backup-disk/sigun        sh scripts/backup-offsite.sh
OFFSITE_DEST=user@nas.local:/volume1/sigun sh scripts/backup-offsite.sh
```

옮기고 끝내지 않고 **저쪽에서 개수를 세어** 모자라면 실패로 끝난다. 원본은
지우지 않는다(`--delete`를 쓰지 않는다) — 서버 쪽 보존 기간이 짧아져도 밖에
있는 사본까지 함께 사라지면 이 사본의 존재 이유가 없어진다.

호스트 crontab에 한 줄. 백업이 뜬 뒤 시각으로 잡는다.

```cron
0 6 * * * cd /srv/sigun-typing && OFFSITE_DEST=... sh scripts/backup-offsite.sh >> /var/log/sigun-offsite.log 2>&1
```

원격이 없다면 최소한 다른 물리 디스크로 복사한다. 같은 디스크 안에서 옮기는
것은 백업이 아니다.

### 복구 예행연습

백업이 매일 도는 것과 그 파일로 되살릴 수 있다는 것은 다른 이야기다. 둘
사이의 거리는 대개 정작 필요한 날에 발견된다.

```bash
sh scripts/restore-drill.sh            # 가장 최근 백업으로
sh scripts/restore-drill.sh <파일>     # 특정 백업으로
```

일회용 포스트그레스를 띄워 실제로 부어 넣고, 압축이 온전한지 · 복원 중
오류가 없었는지 · **스키마가 지금 운영 DB와 같은지** · 표마다 몇 행이
들어왔는지를 본다. 운영 DB는 읽기만 한다.

행 수는 백업 이후에 쌓인 만큼 당연히 다르므로 참고로만 보고, 판정은
스키마가 가른다 — "이 백업으로 지금 코드를 그대로 띄울 수 있는가"가 알고
싶은 것이기 때문이다.

한 달에 한 번, 그리고 **마이그레이션을 배포한 직후**에 돌린다. 스키마를
바꾼 날은 백업과 코드가 어긋나기 가장 쉬운 날이다.

> 덤프에는 소유자를 운영 계정(`sigun`)으로 돌리는 구문이 들어 있다. 빈
> 서버에 복구할 때는 그 역할을 먼저 만들어야 한다. 예행연습 스크립트는
> 그 한 줄을 대신 해 주지만, 손으로 복구할 때는 잊기 쉽다.
>
> ```sql
> CREATE ROLE sigun LOGIN PASSWORD '...';
> ```

### 복구

```bash
gunzip -c backups/sigun-<날짜>.sql.gz | \
  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

덮어쓰기 전에 위의 예행연습을 먼저 돌릴 것. 복구되지 않는 백업은 없느니만
못하다.

## 공유 카드

`public/og.png`는 **빌드해서 커밋해 둔 결과물**이다. 링크를 붙였을 때 뜨는
미리보기가 이 한 장이다.

```bash
npm run build:og      # 지도·색·문구를 고쳤을 때만
```

진짜 크로미움이 진짜 폰트와 진짜 지도 데이터로 그린다(Playwright는 개발
의존성이라 운영 이미지에는 들어가지 않는다). 런타임 생성을 쓰지 않은 이유는
satori가 woff2를 읽지 못해 한글 폰트를 따로 넣어야 하기 때문이다.

카드의 제목·설명은 이미지가 아니라 `metadata`에서 온다. 그래서 문구를 고칠
때 이미지를 다시 뜰 필요는 없다. `metadataBase`가 빠지면 상대 경로가 절대
주소로 바뀌지 않아 크롤러가 이미지를 통째로 무시한다.

## 배포할 때 화면 판번호를 박는다

이벤트마다 함께 저장돼, 화면을 계속 고치면서도 **어느 화면의 숫자인지** 가를
수 있다. 안 넣고 빌드해도 게임은 돌아가지만 그 배포의 숫자는 `dev`로 뭉쳐
나중에 구분할 수 없다.

```bash
UI_REVISION=$(git rev-parse --short HEAD) docker compose build web
docker compose up -d web
```

```sql
-- 어느 화면에서 첫 정답까지 갔는가
SELECT revision,
       count(*) FILTER (WHERE name = 'game_start')    AS 시작,
       count(*) FILTER (WHERE name = 'first_correct') AS 첫정답
FROM events WHERE NOT internal GROUP BY revision ORDER BY revision;
```

## 오류 보기

500이 나도 아무도 안 보면 없는 일이 된다. 관측 기간에 숫자가 이상할 때
"사람들이 안 하는 것"과 "터진 것"을 구분할 수 있어야 한다.

```bash
# 컨테이너 로그 — DB가 죽어서 난 오류도 여기에는 남는다
docker compose logs web socket | grep '^\[error\]'

# 쌓인 것을 모아 보기 — 무엇이 몇 번, 언제부터
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < scripts/errors.sql
```

서버 오류는 Next의 `onRequestError`가, 브라우저 오류는 `app/error.tsx`가
`/api/errors`로 보낸다. 양쪽 다 로그와 DB에 남는다 — DB가 원인인 고장에서는
DB에 못 남기므로 로그가 최후의 경로다.

기록에는 요청 본문도 입력한 지명도 담지 않는다. 주소는 경로만 남기고 물음표
뒤는 뗀다(도전장 링크에는 닉네임이 실려 있다).

## 행정구역 갱신

**지리 학습 서비스에서 데이터 최신성은 부차적인 문제가 아니다.** 시간이 지나면
사용자가 틀린 게 아니라 게임의 정답이 틀린 상황이 생긴다. 그때 필요한 것은
면책 문구가 아니라 갱신이다.

기준 시점은 `data/vintage.ts` 한 곳에 있고 화면의 모든 표기가 여기서 나온다.

### 언제

행정안전부가 시·군·구 개편을 고시하고, 통계청 SGIS가 그 경계를 반영한 뒤에
한다. **둘 중 하나만 바뀐 상태로 손대면 안 된다** — 코드만 최신으로 맞추면
지도 매칭이 깨진다. 실제로 지금 전남·광주 통합과 인천 재편이 코드는 나왔는데
경계가 없어 2025년 시점으로 고정돼 있다(`data/reference/pinned-2025.ts`).

연 1회, 통계청 경계 자료가 갱신되는 시점에 맞춰 확인하면 충분하다.

### 어떻게

1. 새 경계 자료를 `data/geo/source/`에 둔다.
2. `data/reference/administrative-codes.json`을 새 법정동코드로 바꾼다.
3. 바뀐 지역을 `data/courses/*.ts`에 반영한다. 이름·순서·별칭이 달라졌다면
   그 코스의 `version`을 **반드시 올린다** — 기록을 비교할 수 있는지가 여기서
   갈린다.
4. `npm run build:geo` — 미매칭·중복·남은 원본을 보고서로 찍어 준다. 0이
   아니면 진행하지 않는다.
5. `npm test` — 코스 지문 스냅샷이 깨진다. 판번호를 올렸는지 확인한 뒤
   `npx vitest -u`로 갱신한다. **지문만 바뀌고 판번호가 그대로인 채로 갱신하면
   안 된다.** 그 순간 옛 기록과 새 기록이 같은 순위표에서 비교된다.
6. `data/vintage.ts`의 연도를 올린다.
7. `npm run build:og` — 지도가 바뀌었으면 공유 카드도 다시 뜬다.

옛 판번호의 기록은 지우지 않는다. 순위표가 판번호로 갈라 놓으므로 섞이지
않고, 그대로 남아 있다.

## 뜬 뒤에 확인할 것

서명 키 지문이 두 서비스에서 같아야 한다.

```bash
docker compose logs web socket | grep 지문
# [web]    기록 서명 키 지문 598ec68c
# [socket] 기록 서명 키 지문 598ec68c
```

다르면 둘 다 멀쩡히 뜨지만 **멀티로 완주한 기록만 서명 오류로 거부된다.**
가장 알아채기 어려운 형태의 고장이라 부팅 때 눈으로 대조할 수 있게 해 뒀다.
지문은 비밀키의 SHA-256 앞 8자이며 비밀키 자체는 로그에 남지 않는다.

### 방어선이 실제로 서 있는지

```bash
npm run drill:ops                                  # 로컬 컨테이너
TARGET=https://sigun-typing.ysw.kr npm run drill:ops   # 운영
```

유닛 테스트는 규칙이 옳은지를 보고, 이건 **그 규칙이 지금 떠 있는 서버에
붙어 있는지**를 본다. 둘은 다르다 — 라우트를 옮기거나 프록시를 손대면
규칙은 그대로인 채 길만 비켜 갈 수 있고, 그때 유닛 테스트는 전부 초록이다.

확인하는 것:

| | |
| --- | --- |
| 이벤트 레이트리밋 | 기기당 분당 30건에서 막히고, 다른 기기는 안 막힌다 |
| 타수 부풀리기 | 지역명에서 나오는 최대 타수를 넘으면 거부 |
| 기계 리듬 | 타건 간격이 지나치게 일정하면 거부 |
| 불가능한 속도 | 사람이 낼 수 없는 간격이면 거부 |
| 토큰 없음·코스 바꿔치기·모드 바꿔치기 | 각각 거부 |
| **정직한 기록** | **받아 준다** |

마지막 줄이 없으면 "전부 막는 서버"도 위의 검사를 모두 통과한다. 방어선이
아니라 벽이 되어 있어도 모른다.

운영에 대고 돌리면 닉네임 `예행연습`으로 기록이 한 줄 남는다. 지우는
명령은 실행이 끝나면서 화면에 나온다.

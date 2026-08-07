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
- `APP_ORIGIN`은 실제 서비스 주소와 정확히 같아야 한다.
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

`./backups`는 같은 디스크에 있다. 디스크가 통째로 죽는 경우까지 대비하려면
이 디렉터리를 서버 밖으로 한 번 더 옮겨 두어야 한다(rsync·오브젝트 스토리지 등).

### 복구

```bash
gunzip -c backups/sigun-<날짜>.sql.gz | \
  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

덮어쓰기 전에 **빈 데이터베이스에 먼저 복구해 보고 행 수를 확인할 것.**
복구되지 않는 백업은 없느니만 못하다.

```bash
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE restore_test"
gunzip -c backups/sigun-<날짜>.sql.gz | \
  docker compose exec -T db psql -q -U "$POSTGRES_USER" -d restore_test
docker compose exec -T db psql -U "$POSTGRES_USER" -d restore_test -c "SELECT count(*) FROM scores"
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE restore_test"
```

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

#!/bin/sh
# 공유 카드 그림에 쓸 한글 폰트를 만든다. 결과: assets/pretendard-{400,700}.ttf
#
# 왜 필요한가 — satori(next/og)는 woff2를 못 읽는다. 저장소의 한글 폰트는
# public/fonts/PretendardVariable.woff2 하나뿐이라, 그대로는 카드에 한글이
# 안 나온다(네모로 뜬다).
#
# 왜 subset 하는가 — 그 woff2를 ttf로 풀면 6.7MB이고, 고정 무게로 굳혀도
# 3MB씩이다. 운영 이미지에 그걸 두 벌 넣을 이유가 없다. 카드에 실제로 나오는
# 글자는 코스 이름과 모드 이름, 숫자, 문구 몇 개뿐이라 249자 35KB로 줄어든다.
#
# 코스가 늘거나 카드 문구가 바뀌면 다시 돌린다. 빠진 글자는 네모로 뜬다.
set -eu
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

python3 -m venv "$tmp/venv"
"$tmp/venv/bin/pip" install -q fonttools brotli

# 카드에 나올 수 있는 글자를 코스 데이터에서 그대로 긁는다. 손으로 적으면 샌다.
npx tsx -e "
import { COURSES } from './data/courses';
import { MODE_LABELS } from './lib/game/modes';
const fixed = '시군 타이핑님의기록입니다지도로넘어설수있나요분초전부곳중힌트번같이한판받은';
const chars = new Set();
for (const c of COURSES) for (const ch of c.name) chars.add(ch);
for (const v of Object.values(MODE_LABELS)) for (const ch of v) chars.add(ch);
for (const ch of fixed) chars.add(ch);
for (const ch of '0123456789.:/-(), ') chars.add(ch);
process.stdout.write([...chars].sort().join(''));
" > "$tmp/glyphs.txt"

"$tmp/venv/bin/python" -c "
from fontTools.ttLib import TTFont
f = TTFont('public/fonts/PretendardVariable.woff2')
f.flavor = None
f.save('$tmp/var.ttf')
"

mkdir -p assets
for w in 400 700; do
  # 가변 축을 satori가 해석하지 않으므로 무게를 굳힌다.
  "$tmp/venv/bin/python" -m fontTools.varLib.instancer \
    "$tmp/var.ttf" "wght=$w" -o "$tmp/$w.ttf" >/dev/null
  "$tmp/venv/bin/pyftsubset" "$tmp/$w.ttf" \
    --text-file="$tmp/glyphs.txt" \
    --output-file="assets/pretendard-$w.ttf" \
    --layout-features='' --no-hinting --desubroutinize \
    --drop-tables+=GSUB,GPOS,GDEF,STAT,DSIG
done

ls -l assets/

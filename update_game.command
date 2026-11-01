#!/bin/bash
# Glub Glub Diver 최신 코드를 홈페이지로 복사 (index.html은 공유용 태그가 있어서 복사하지 않음)
# 복사 후 GitHub Desktop이나 git으로 push 하면 1~2분 뒤 사이트에 반영돼요.
cd "$(dirname "$0")"
SRC="../glubglub diver/src"
cp "$SRC/game.js" "$SRC/manifest.js" "$SRC/assets_data.js" "$SRC/music_data.js" "$SRC/splash_logo.png" glubglub-diver/
echo "복사 완료: game.js, manifest.js, assets_data.js, music_data.js, splash_logo.png"
echo "index.html을 바꿨다면 glubglub-diver/index.html 에 직접 옮겨 주세요."
echo "glubglub-diver/index.html 의 .js?v=날짜 를 오늘 날짜로 바꿔야 방문자 브라우저에 바로 반영돼요."

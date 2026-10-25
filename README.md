# Chaddy Company 홈페이지

GitHub Pages로 배포되는 회사 홈페이지 (`js02116.github.io` 저장소).

| 주소 | 내용 |
|---|---|
| https://js02116.github.io/ | 회사 홈페이지 (`index.html`) |
| https://js02116.github.io/glubglub-diver/ | Glub Glub Diver 플레이 (`glubglub-diver/`) |

이 저장소는 **공개**예요. 게임 원본 코드·이미지는 비공개 저장소(`glubglub-diver`)에 두고, 여기에는 플레이에 필요한 파일만 올려요.

## 게임 업데이트
1. `update_game.command` 더블클릭 → 게임 최신 파일이 `glubglub-diver/`로 복사돼요.
2. commit 후 push → 1~2분 뒤 사이트에 반영돼요.

## 로컬에서 확인
```bash
python3 -m http.server 8000
```
브라우저에서 http://localhost:8000 을 열어요.

## 새 게임/앱 추가
`index.html`의 `#games` 섹션에 `<article class="feature">` 카드를 하나 더 만들고, 게임 파일은 새 폴더(예: `new-game/`)에 넣어요.

# 丕刀卜己卜人丨廿卜 — GitHub Pages 블로그

네이버 블로그 스타일의 정적 블로그. 서버 없이 GitHub Pages에서 바로 동작.

## 기능
- **게시판**: 카테고리별 글 목록, 검색, 게시판 생성/삭제 (관리자 전용, 삭제 시 글은 '미분류'로 이동)
- **글쓰기**: 리치텍스트 에디터 (굵게/기울임/목록/인용/이미지) — 관리자 전용
- **사진 첨부**: 📷 버튼으로 기기 사진 업로드 — 자동 리사이즈(최대 1280px)·JPEG 압축 후 글에 삽입
- **HTML 모드**: HTML 코드 직접 붙여넣기 가능
- **댓글**: 이름 + 비밀번호(삭제용, SHA-256 해시 저장) — **관리자 승인 후 공개**
- **댓글 사진 첨부**: 누구나 📷 버튼으로 사진 공유 (자동 리사이즈 900px·JPEG 압축). 비밀댓글 사진은 본문과 함께 암호화
- **스팸 필터**: 링크 3개 이상 또는 금지어 포함 시 '스팸 의심' 자동 분류
- **비밀댓글**: AES-GCM(Web Crypto) 암호화 저장 — 비밀번호를 아는 사람만 열람

## 관리자
- 우측 상단 **관리자** 클릭 → 최초 1회 비밀번호 설정(4자 이상), 이후 로그인
- 로그인하면: 글쓰기·글 수정/삭제·게시판 추가/삭제·댓글 승인/삭제 가능
- 비밀번호는 SHA-256 해시로 브라우저에 저장. 로그인 상태는 탭 닫으면 해제
- 비밀번호를 잊으면: 개발자도구 콘솔에서 `localStorage.removeItem('blog_admin_hash')` 후 재설정
- ⚠️ 정적 사이트라 서버 검증은 없음 — 개발자도구를 아는 방문자는 우회 가능. 실제 보안이 필요하면 서버(Supabase 등) 필요

## GitHub Pages 배포
1. GitHub에서 새 저장소 생성 (예: `my-blog`)
2. 이 폴더 내용 업로드:
   ```
   git init
   git add .
   git commit -m "feat: blog"
   git branch -M main
   git remote add origin https://github.com/<계정명>/my-blog.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Source: Deploy from a branch → main / (root)** 선택
4. 몇 분 후 `https://<계정명>.github.io/my-blog/` 접속

## 알아둘 것 (중요)
- 글과 댓글은 **브라우저 localStorage**에 저장된다. 즉 **작성한 브라우저에서만 보인다.**
  GitHub Pages는 정적 호스팅이라 서버 저장이 불가능하기 때문.
- 여러 방문자가 공유하는 진짜 게시판/댓글이 필요하면:
  - 댓글: [giscus](https://giscus.app) (GitHub Discussions 기반, 무료) 연동
  - 글/댓글 DB: Supabase(무료 티어) 연동
- 비밀댓글 암호화는 클라이언트에서 수행되며, 비밀번호를 잊으면 복호화 불가.

## 파일 구조
```
index.html      페이지 골격 + 템플릿
css/style.css   디자인 (Stitch editorial 시스템 기반)
js/app.js       라우팅·저장·암호화·렌더링
```

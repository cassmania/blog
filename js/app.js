/* 丕刀卜己卜人丨廿卜 blog — GitHub Pages 정적 블로그
   저장소: localStorage (브라우저별). 비밀댓글: Web Crypto AES-GCM 암호화.
   관리자: 글쓰기·수정·삭제, 게시판 관리, 댓글 승인/삭제. */

const store = {
  getPosts: () => JSON.parse(localStorage.getItem('blog_posts') || '[]'),
  setPosts: (p) => localStorage.setItem('blog_posts', JSON.stringify(p)),
  getBoards: () => JSON.parse(localStorage.getItem('blog_boards') || '[]'),
  setBoards: (b) => localStorage.setItem('blog_boards', JSON.stringify(b)),
  getComments: (postId) => JSON.parse(localStorage.getItem('blog_comments_' + postId) || '[]'),
  setComments: (postId, c) => localStorage.setItem('blog_comments_' + postId, JSON.stringify(c)),
};

/* ===== 암호화 유틸 ===== */
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = {
  from: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  to: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encryptText(text, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { salt: b64.from(salt), iv: b64.from(iv), data: b64.from(cipher) };
}

async function decryptText(payload, password) {
  const key = await deriveKey(password, b64.to(payload.salt));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64.to(payload.iv) }, key, b64.to(payload.data)
  );
  return dec.decode(plain);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return b64.from(buf);
}

/* ===== 관리자 ===== */
const admin = {
  isSet: () => !!localStorage.getItem('blog_admin_hash'),
  isLoggedIn: () => sessionStorage.getItem('blog_admin') === '1',
  async setup() {
    const pw = prompt('관리자 비밀번호를 설정하세요 (최초 1회)');
    if (!pw || pw.length < 4) { if (pw !== null) alert('4자 이상 입력하세요.'); return false; }
    const pw2 = prompt('비밀번호를 한 번 더 입력하세요');
    if (pw !== pw2) { alert('비밀번호가 일치하지 않습니다.'); return false; }
    localStorage.setItem('blog_admin_hash', await sha256(pw));
    sessionStorage.setItem('blog_admin', '1');
    return true;
  },
  async login() {
    if (!this.isSet()) return this.setup();
    const pw = prompt('관리자 비밀번호를 입력하세요');
    if (pw === null) return false;
    if (await sha256(pw) !== localStorage.getItem('blog_admin_hash')) {
      alert('비밀번호가 일치하지 않습니다.');
      return false;
    }
    sessionStorage.setItem('blog_admin', '1');
    return true;
  },
  logout() { sessionStorage.removeItem('blog_admin'); },
};

function applyAdminUI() {
  const on = admin.isLoggedIn();
  document.querySelectorAll('.admin-only').forEach((el) => { el.hidden = !on; });
  const link = $('#btn-admin');
  if (link) link.textContent = on ? '로그아웃' : '관리자';
}

/* ===== 스팸 필터 (댓글) ===== */
const SPAM_WORDS = ['도박', '카지노', '대출', '홍보', 'sex', 'viagra', 'casino'];
function isSpam(text) {
  const links = (text.match(/https?:\/\//g) || []).length;
  if (links >= 3) return true;
  const low = text.toLowerCase();
  return SPAM_WORDS.some((w) => low.includes(w));
}

/* ===== 공용 ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function excerpt(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim().slice(0, 140);
}

function firstImage(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.querySelector('img')?.src || null;
}

function thumbFor(p) {
  return firstImage(p.content) || `https://picsum.photos/seed/${encodeURIComponent(p.id)}/800/500`;
}

function compressImage(file, maxW = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

function render(tplId) {
  app.innerHTML = '';
  app.appendChild($('#' + tplId).content.cloneNode(true));
  applyAdminUI();
}

/* 스크롤 리빌 (prefers-reduced-motion 존중) */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) {
      en.target.classList.add('in-view');
      revealObserver.unobserve(en.target);
    }
  });
}, { threshold: 0.12 });

function initReveal() {
  if (reduceMotion.matches) return;
  app.querySelectorAll('.post-card, .post-item, .alt-row, .pillar, .interstitial, .intro-split')
    .forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', `${Math.min(i % 6, 4) * 70}ms`);
      revealObserver.observe(el);
    });
}

function postItemHtml(p) {
  return `<a class="post-item" href="#/post/${p.id}">
    <div class="item-thumb"><img src="${thumbFor(p)}" alt="" loading="lazy"></div>
    <div class="item-body">
      <span class="item-category">${escapeHtml(p.category || '미분류')}</span>
      <h3>${escapeHtml(p.title)}</h3>
      <p class="item-excerpt">${escapeHtml(excerpt(p.content))}</p>
      <div class="item-meta">${fmtDate(p.createdAt)}</div>
    </div>
  </a>`;
}

function postCardHtml(p) {
  return `<a class="post-card" href="#/post/${p.id}">
    <div class="card-thumb"><img src="${thumbFor(p)}" alt="" loading="lazy"></div>
    <span class="item-category">${escapeHtml(p.category || '미분류')}</span>
    <h3>${escapeHtml(p.title)}</h3>
    <p class="item-excerpt">${escapeHtml(excerpt(p.content))}</p>
    <div class="item-meta">${fmtDate(p.createdAt)}</div>
  </a>`;
}

/* ===== 페이지: 홈 ===== */
function pageHome() {
  render('tpl-home');
  const posts = store.getPosts().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const box = $('#recent-posts');
  box.innerHTML = posts.length
    ? posts.slice(0, 5).map(postCardHtml).join('')
    : '<p class="empty-msg">아직 글이 없습니다.</p>';
  box.querySelector('.post-card')?.classList.add('is-featured');
  initReveal();
}

/* ===== 페이지: 게시판 ===== */
function pageBoard(category) {
  render('tpl-board');
  const posts = store.getPosts().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const counts = {};
  posts.forEach((p) => {
    const c = p.category || '미분류';
    counts[c] = (counts[c] || 0) + 1;
  });
  const boards = [...new Set([...store.getBoards(), ...Object.keys(counts)])];
  const delBtn = (c) => admin.isLoggedIn()
    ? `<button type="button" class="btn-del-board" data-board="${escapeHtml(c)}" title="게시판 삭제">×</button>` : '';
  $('#category-list').innerHTML =
    `<li><a href="#/board" class="${!category ? 'active' : ''}">전체 <span class="cat-count">${posts.length}</span></a></li>` +
    boards.map((c) =>
      `<li><a href="#/board/${encodeURIComponent(c)}" class="${category === c ? 'active' : ''}">${escapeHtml(c)} <span class="cat-count">${counts[c] || 0}</span></a>${delBtn(c)}</li>`
    ).join('');

  if (category) $('#board-title').textContent = category;

  $('#btn-add-board').addEventListener('click', () => {
    if (!admin.isLoggedIn()) return;
    const name = prompt('새 게시판 이름을 입력하세요');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (boards.includes(trimmed)) { alert('이미 있는 게시판입니다.'); return; }
    store.setBoards([...store.getBoards(), trimmed]);
    pageBoard(category);
  });

  $('#category-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-del-board');
    if (!btn || !admin.isLoggedIn()) return;
    const name = btn.dataset.board;
    const inUse = counts[name] || 0;
    if (inUse) {
      if (!confirm(`'${name}' 게시판에 글이 ${inUse}개 있습니다. 게시판을 삭제하면 글은 '미분류'로 이동합니다. 삭제할까요?`)) return;
      posts.forEach((p) => { if ((p.category || '미분류') === name) p.category = ''; });
      store.setPosts(posts);
    } else if (!confirm(`'${name}' 게시판을 삭제할까요?`)) return;
    store.setBoards(store.getBoards().filter((b) => b !== name));
    if (category === name) { location.hash = '#/board'; return; }
    pageBoard(category);
  });

  const draw = (keyword) => {
    let list = category ? posts.filter((p) => (p.category || '미분류') === category) : posts;
    if (keyword) {
      const k = keyword.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(k) || excerpt(p.content).toLowerCase().includes(k));
    }
    $('#board-posts').innerHTML = list.length
      ? list.map(postItemHtml).join('')
      : '<p class="empty-msg">글이 없습니다.</p>';
    initReveal();
  };
  draw('');
  $('#search-input').addEventListener('input', (e) => draw(e.target.value.trim()));
}

/* ===== 페이지: 글쓰기 / 수정 (관리자 전용) ===== */
function pageWrite(editId) {
  if (!admin.isLoggedIn()) {
    admin.login().then((ok) => {
      applyAdminUI();
      if (ok) pageWrite(editId);
      else location.hash = '#/';
    });
    return;
  }
  render('tpl-write');
  const posts = store.getPosts();
  const editing = editId ? posts.find((p) => p.id === editId) : null;
  if (editId && !editing) { location.hash = '#/board'; return; }

  const editor = $('#editor');
  const htmlSrc = $('#html-source');
  let mode = 'editor';

  $('#category-options').innerHTML =
    [...new Set([...store.getBoards(), ...posts.map((p) => p.category).filter(Boolean)])]
      .map((c) => `<option value="${escapeHtml(c)}">`).join('');

  if (editing) {
    $('#write-title').textContent = '글 수정';
    $('#post-title').value = editing.title;
    $('#post-category').value = editing.category || '';
    editor.innerHTML = editing.content;
  }

  const setMode = (m) => {
    if (m === mode) return;
    if (m === 'html') htmlSrc.value = editor.innerHTML;
    else editor.innerHTML = htmlSrc.value;
    mode = m;
    $('#editor-field').hidden = m !== 'editor';
    $('#html-field').hidden = m !== 'html';
    $('#mode-editor').classList.toggle('active', m === 'editor');
    $('#mode-html').classList.toggle('active', m === 'html');
  };
  $('#mode-editor').addEventListener('click', () => setMode('editor'));
  $('#mode-html').addEventListener('click', () => setMode('html'));

  $('.editor-toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    editor.focus();
    document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
  });
  $('#btn-image').addEventListener('click', () => {
    const url = prompt('이미지 URL을 입력하세요');
    if (url) { editor.focus(); document.execCommand('insertImage', false, url); }
  });

  // 에디터 붙여넣기: 이미지 URL이면 <img>로 자동 변환
  const IMG_URL_RE = /^https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg|avif|bmp)(\?[^\s]*)?$/i;
  editor.addEventListener('paste', (e) => {
    const text = e.clipboardData.getData('text/plain').trim();
    if (!IMG_URL_RE.test(text)) return;
    e.preventDefault();
    document.execCommand('insertImage', false, text);
  });

  // 사진 첨부: 파일 → 리사이즈·압축 → data URL로 본문 삽입
  // ponytail: localStorage 한계(~5MB) 대응으로 최대 1280px·JPEG 0.8 압축. 대용량 필요하면 이미지 호스팅(imgur 등) URL 사용
  $('#btn-photo').addEventListener('click', () => $('#photo-input').click());
  $('#photo-input').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      try {
        const dataUrl = await compressImage(file);
        editor.focus();
        document.execCommand('insertImage', false, dataUrl);
      } catch {
        alert(`'${file.name}' 처리 실패 — 이미지 파일인지 확인하세요.`);
      }
    }
    e.target.value = '';
  });

  $('#write-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const content = mode === 'html' ? htmlSrc.value : editor.innerHTML;
    if (!content.trim()) { alert('본문을 입력하세요.'); return; }
    if (editing) {
      editing.title = $('#post-title').value.trim();
      editing.category = $('#post-category').value.trim();
      editing.content = content;
      editing.updatedAt = new Date().toISOString();
    } else {
      posts.push({
        id: Date.now().toString(36),
        title: $('#post-title').value.trim(),
        category: $('#post-category').value.trim(),
        content,
        createdAt: new Date().toISOString(),
      });
    }
    try {
      store.setPosts(posts);
    } catch {
      alert('저장 공간이 가득 찼습니다. 첨부 사진 수를 줄이거나 기존 글을 정리하세요.');
      return;
    }
    location.hash = editing ? '#/post/' + editing.id : '#/post/' + posts[posts.length - 1].id;
  });
}

/* ===== 페이지: 글 보기 + 댓글 ===== */
function pagePost(id) {
  const posts = store.getPosts();
  const post = posts.find((p) => p.id === id);
  if (!post) { location.hash = '#/board'; return; }

  render('tpl-post');
  $('#view-category').textContent = post.category || '미분류';
  $('#view-title').textContent = post.title;
  $('#view-date').textContent = fmtDate(post.createdAt);
  $('#view-content').innerHTML = post.content; // 관리자 본인 HTML — 그대로 렌더

  $('#btn-edit-post').addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = '#/write/' + post.id;
  });
  $('#btn-delete-post').addEventListener('click', (e) => {
    e.preventDefault();
    if (!admin.isLoggedIn() || !confirm('이 글을 삭제할까요?')) return;
    store.setPosts(posts.filter((p) => p.id !== id));
    localStorage.removeItem('blog_comments_' + id);
    location.hash = '#/board';
  });

  drawComments(id);

  // 댓글 사진 첨부
  let pendingPhoto = null;
  const preview = $('#comment-photo-preview');
  $('#btn-comment-photo').addEventListener('click', () => $('#comment-photo-input').click());
  $('#comment-photo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingPhoto = await compressImage(file, 900, 0.75);
      preview.querySelector('img').src = pendingPhoto;
      preview.hidden = false;
    } catch {
      alert('이미지 파일인지 확인하세요.');
    }
    e.target.value = '';
  });
  const clearPhoto = () => { pendingPhoto = null; preview.hidden = true; preview.querySelector('img').src = ''; };
  $('#btn-remove-photo').addEventListener('click', clearPhoto);

  $('#comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#comment-name').value.trim();
    const pw = $('#comment-pw').value;
    const body = $('#comment-body').value.trim();
    const secret = $('#comment-secret').checked;
    if (!name || !pw || !body) return;

    const comment = {
      id: Date.now().toString(36),
      name,
      pwHash: await sha256(pw),
      createdAt: new Date().toISOString(),
      secret,
      status: 'pending',
      spam: isSpam(body),
    };
    if (secret) {
      // 비밀댓글: 본문+사진 묶어서 암호화
      comment.encrypted = await encryptText(JSON.stringify({ body, photo: pendingPhoto }), pw);
    } else {
      comment.body = body;
      if (pendingPhoto) comment.photo = pendingPhoto;
    }

    const comments = store.getComments(id);
    comments.push(comment);
    try {
      store.setComments(id, comments);
    } catch {
      alert('저장 공간이 가득 찼습니다. 사진 크기를 줄이거나 관리자에게 문의하세요.');
      return;
    }
    e.target.reset();
    clearPhoto();
    alert(comment.spam
      ? '스팸으로 분류되어 관리자 확인 후 공개됩니다.'
      : '댓글이 등록되었습니다. 관리자 승인 후 공개됩니다.');
    drawComments(id);
  });
}

function drawComments(postId) {
  const all = store.getComments(postId);
  const isAdmin = admin.isLoggedIn();
  const comments = isAdmin ? all : all.filter((c) => c.status === 'approved');
  $('#comment-count').textContent = comments.length;
  const list = $('#comment-list');

  const statusBadge = (c) => {
    if (!isAdmin || c.status === 'approved') return '';
    return c.spam
      ? '<span class="badge badge-spam">스팸 의심</span>'
      : '<span class="badge badge-pending">승인 대기</span>';
  };
  const adminActions = (c) => {
    if (!isAdmin) return '';
    const approve = c.status !== 'approved' ? '<a href="#" class="btn-approve">승인</a>' : '';
    return `${approve}<a href="#" class="btn-admin-del">삭제(관리자)</a>`;
  };

  list.innerHTML = comments.map((c) => `
    <li class="comment-item ${c.status !== 'approved' ? 'is-pending' : ''}" data-id="${c.id}">
      <div class="comment-head">
        <span class="comment-name">${c.secret ? '<svg class="icon-sm lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ' : ''}${escapeHtml(c.name)} ${statusBadge(c)}</span>
        <span class="comment-date">${fmtDate(c.createdAt)}</span>
      </div>
      ${c.secret
        ? `<div class="comment-secret-body">
             비밀댓글입니다.
             <input type="password" class="secret-pw" placeholder="비밀번호">
             <button type="button" class="btn-unlock">확인</button>
           </div>`
        : `<p class="comment-body">${escapeHtml(c.body)}</p>` +
          (c.photo ? `<img class="comment-photo" src="${escapeHtml(c.photo)}" alt="첨부 사진" loading="lazy">` : '')}
      <div class="comment-actions">
        <a href="#" class="btn-del-comment">삭제</a>
        ${adminActions(c)}
      </div>
    </li>`).join('');

  list.querySelectorAll('.btn-unlock').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.comment-item');
      const c = all.find((x) => x.id === item.dataset.id);
      const pw = item.querySelector('.secret-pw').value;
      try {
        const text = await decryptText(c.encrypted, pw);
        let body = text, photo = null;
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') { body = parsed.body; photo = parsed.photo; }
        } catch { /* 구버전 비밀댓글: 평문 문자열 */ }
        item.querySelector('.comment-secret-body').outerHTML =
          `<p class="comment-body">${escapeHtml(body)}</p>` +
          (photo ? `<img class="comment-photo" src="${escapeHtml(photo)}" alt="첨부 사진">` : '');
      } catch {
        alert('비밀번호가 일치하지 않습니다.');
      }
    });
  });

  list.querySelectorAll('.btn-del-comment').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const item = btn.closest('.comment-item');
      const c = all.find((x) => x.id === item.dataset.id);
      const pw = prompt('댓글 비밀번호를 입력하세요');
      if (pw === null) return;
      if (await sha256(pw) !== c.pwHash) { alert('비밀번호가 일치하지 않습니다.'); return; }
      store.setComments(postId, all.filter((x) => x.id !== c.id));
      drawComments(postId);
    });
  });

  list.querySelectorAll('.btn-approve').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!admin.isLoggedIn()) return;
      const c = all.find((x) => x.id === btn.closest('.comment-item').dataset.id);
      c.status = 'approved';
      c.spam = false;
      store.setComments(postId, all);
      drawComments(postId);
    });
  });

  list.querySelectorAll('.btn-admin-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!admin.isLoggedIn() || !confirm('이 댓글을 삭제할까요?')) return;
      const cid = btn.closest('.comment-item').dataset.id;
      store.setComments(postId, all.filter((x) => x.id !== cid));
      drawComments(postId);
    });
  });
}

/* ===== 라우터 ===== */
function route() {
  const hash = location.hash || '#/';
  const parts = hash.slice(2).split('/').map(decodeURIComponent);
  document.querySelectorAll('.main-nav a').forEach((a) => a.classList.remove('active'));

  if (parts[0] === 'board') {
    $('[data-nav="board"]').classList.add('active');
    pageBoard(parts[1] || null);
  } else if (parts[0] === 'write') {
    $('[data-nav="write"]').classList.add('active');
    pageWrite(parts[1] || null);
  } else if (parts[0] === 'post') {
    pagePost(parts[1]);
  } else {
    $('[data-nav="home"]').classList.add('active');
    pageHome();
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

$('#btn-admin').addEventListener('click', async (e) => {
  e.preventDefault();
  if (admin.isLoggedIn()) {
    admin.logout();
  } else {
    await admin.login();
  }
  route();
});

/* 첫 방문 시 샘플 글 */
if (!localStorage.getItem('blog_posts')) {
  store.setPosts([{
    id: 'welcome',
    title: '블로그를 시작합니다',
    category: '공지',
    content: '<p>丕刀卜己卜人丨廿卜 블로그에 오신 것을 환영합니다.</p><p>관리자로 로그인하면 <b>글쓰기</b> 버튼이 나타나고, HTML 모드에서는 코드를 직접 붙여넣을 수 있습니다.</p><blockquote>기록은 생각을 단단하게 만든다.</blockquote>',
    createdAt: new Date().toISOString(),
  }]);
}

route();

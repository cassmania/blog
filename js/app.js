/* 丕刀卜己卜人丨廿卜 blog — GitHub Pages 정적 블로그 + Supabase 백엔드
   글·댓글·게시판·설정 전부 Supabase DB 저장 — 모든 방문자가 같은 내용을 봄.
   비밀댓글: Web Crypto AES-GCM 암호화. 관리자: Supabase Auth 이메일 로그인. */

const SUPABASE_URL = 'https://uarrnlbgowejwulzixqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dsijIbtDJOt8LFGS90lMuA_d_OEHVuO';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ===== DB 계층 ===== */
const mapPost = (r) => ({ id: r.id, title: r.title, category: r.category, content: r.content, createdAt: r.created_at });
const mapComment = (r) => ({
  id: r.id, name: r.name, body: r.body, photo: r.photo, encrypted: r.encrypted,
  secret: r.secret, approved: r.approved, spam: r.spam, pwHash: r.pw_hash, createdAt: r.created_at,
});

const db = {
  async getPosts() {
    const { data, error } = await sb.from('posts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(mapPost);
  },
  async getPost(id) {
    const { data, error } = await sb.from('posts').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapPost(data) : null;
  },
  async createPost(p) {
    const { data, error } = await sb.from('posts')
      .insert({ title: p.title, category: p.category, content: p.content }).select('id').single();
    if (error) throw error;
    return data.id;
  },
  async updatePost(id, p) {
    const { error } = await sb.from('posts')
      .update({ title: p.title, category: p.category, content: p.content, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
  async deletePost(id) {
    const { error } = await sb.from('posts').delete().eq('id', id);
    if (error) throw error;
  },
  async getBoards() {
    const { data, error } = await sb.from('boards').select('name').order('created_at');
    if (error) throw error;
    return data.map((r) => r.name);
  },
  async addBoard(name) {
    const { error } = await sb.from('boards').insert({ name });
    if (error) throw error;
  },
  async deleteBoard(name) {
    const { error: e1 } = await sb.from('posts').update({ category: '' }).eq('category', name);
    if (e1) throw e1;
    const { error: e2 } = await sb.from('boards').delete().eq('name', name);
    if (e2) throw e2;
  },
  async getComments(postId) {
    const { data, error } = await sb.from('comments').select('*')
      .eq('post_id', postId).order('created_at');
    if (error) throw error;
    return data.map(mapComment);
  },
  async addComment(postId, c) {
    const { error } = await sb.from('comments').insert({
      post_id: postId, name: c.name, body: c.body ?? null, photo: c.photo ?? null,
      encrypted: c.encrypted ?? null, secret: c.secret, spam: c.spam, pw_hash: c.pwHash,
    });
    if (error) throw error;
  },
  async approveComment(id) {
    const { error } = await sb.from('comments').update({ approved: true, spam: false }).eq('id', id);
    if (error) throw error;
  },
  async deleteCommentAdmin(id) {
    const { error } = await sb.from('comments').delete().eq('id', id);
    if (error) throw error;
  },
  async deleteCommentWithPw(id, pwHash) {
    const { data, error } = await sb.rpc('delete_comment_with_pw', { cid: id, pw: pwHash });
    if (error) throw error;
    return data === true;
  },
  async getPages() {
    const { data, error } = await sb.from('custom_pages').select('id,title,created_at').order('sort').order('created_at');
    if (error) throw error;
    return data.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at }));
  },
  async getPage(id) {
    const { data, error } = await sb.from('custom_pages').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, title: data.title, content: data.content, createdAt: data.created_at } : null;
  },
  async createPage(p) {
    const { data, error } = await sb.from('custom_pages')
      .insert({ title: p.title, content: p.content }).select('id').single();
    if (error) throw error;
    return data.id;
  },
  async updatePage(id, p) {
    const { error } = await sb.from('custom_pages')
      .update({ title: p.title, content: p.content, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
  async deletePage(id) {
    const { error } = await sb.from('custom_pages').delete().eq('id', id);
    if (error) throw error;
  },
  async getSetting(key) {
    const { data, error } = await sb.from('settings').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    return data ? data.value : {};
  },
  async setSetting(key, value) {
    const { error } = await sb.from('settings').upsert({ key, value });
    if (error) throw error;
  },
};

function dbError(e) {
  console.error(e);
  alert('서버 통신에 실패했습니다. 잠시 후 다시 시도하세요.\n' + (e?.message || ''));
}

/* 게시판 글 목록 등장 효과 */
const BOARD_FX = [
  { key: 'rise', label: '올라오기 (기본)' },
  { key: 'fade', label: '페이드' },
  { key: 'left', label: '왼쪽에서 슬라이드' },
  { key: 'right', label: '오른쪽에서 슬라이드' },
  { key: 'zoom', label: '줌 (작게서 커짐)' },
  { key: 'flip', label: '플립 (기울며 등장)' },
  { key: 'blur', label: '블러 (흐림에서 선명)' },
  { key: 'none', label: '없음' },
];

/* 홈 화면 이미지 슬롯: 기본값 + 효과 목록 */
const IMAGE_SLOTS = [
  { key: 'hero', label: '히어로 (상단 큰 사진)', src: 'https://picsum.photos/seed/athen-hero/1920/900' },
  { key: 'feature1', label: '01 — 기록 섹션', src: 'https://picsum.photos/seed/athen-write/1000/750' },
  { key: 'feature2', label: '02 — 대화 섹션', src: 'https://picsum.photos/seed/athen-talk/1000/750' },
  { key: 'band', label: '중간 배너 (인용구 배경)', src: 'https://picsum.photos/seed/athen-band/1920/700' },
];
const IMAGE_FX = [
  { key: 'none', label: '없음' },
  { key: 'fade', label: '페이드 (서서히 나타남)' },
  { key: 'rise', label: '올라오기' },
  { key: 'zoom', label: '줌 (커지며 선명하게)' },
  { key: 'kenburns', label: '켄번즈 (천천히 계속 확대)' },
];

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

/* ===== 관리자 (Supabase Auth) ===== */
let adminOn = false;

const admin = {
  isLoggedIn: () => adminOn,
  async login() {
    const savedEmail = localStorage.getItem('blog_admin_email') || '';
    const email = prompt('관리자 이메일을 입력하세요', savedEmail);
    if (!email) return false;
    const pw = prompt('비밀번호를 입력하세요');
    if (pw === null) return false;
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) { alert('로그인 실패: 이메일 또는 비밀번호를 확인하세요.'); return false; }
    localStorage.setItem('blog_admin_email', email.trim());
    adminOn = true;
    return true;
  },
  async logout() {
    await sb.auth.signOut();
    adminOn = false;
  },
};

sb.auth.onAuthStateChange((_event, session) => {
  adminOn = !!session;
  applyAdminUI();
});

function applyAdminUI() {
  document.querySelectorAll('.admin-only').forEach((el) => { el.hidden = !adminOn; });
  const link = $('#btn-admin');
  if (link) link.textContent = adminOn ? '로그아웃' : '관리자';
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
  d.textContent = s ?? '';
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

function showLoading() {
  app.innerHTML = '<p class="empty-msg loading-msg">불러오는 중…</p>';
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

/* 관찰 + 안전장치: 이미 화면 안이면 타이머로도 in-view 부여 (IO 미발화 환경 대비) */
function safeObserve(el) {
  revealObserver.observe(el);
  const r = el.getBoundingClientRect();
  if (r.top < innerHeight && r.bottom > 0) {
    setTimeout(() => el.classList.add('in-view'), 400);
  }
}

function initReveal() {
  if (reduceMotion.matches) return;
  app.querySelectorAll('.post-card, .post-item, .alt-row, .pillar, .interstitial, .intro-split')
    .forEach((el, i) => {
      if (el.classList.contains('no-reveal')) return; // 게시판별 효과가 이미 적용됨
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', `${Math.min(i % 6, 4) * 70}ms`);
      safeObserve(el);
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

/* 저장된 이미지·효과를 홈 화면에 적용 */
function applySiteImages(saved) {
  IMAGE_SLOTS.forEach((slot) => {
    const img = app.querySelector(`[data-slot="${slot.key}"]`);
    if (!img) return;
    const conf = saved[slot.key] || {};
    if (conf.src) img.src = conf.src;
    const fx = conf.fx || 'none';
    if (fx === 'none' || reduceMotion.matches) return;
    if (fx === 'kenburns') {
      img.classList.add('fx-kenburns');
    } else {
      img.classList.add('fx', 'fx-' + fx);
      safeObserve(img);
    }
  });
}

/* ===== 페이지: 홈 ===== */
async function pageHome() {
  render('tpl-home');
  try {
    const [posts, images, pages] = await Promise.all([
      db.getPosts(), db.getSetting('site_images'), db.getPages(),
    ]);
    applySiteImages(images);
    const box = $('#recent-posts');
    if (!box) return; // 페이지 이동됨
    box.innerHTML = posts.length
      ? posts.slice(0, 5).map(postCardHtml).join('')
      : '<p class="empty-msg">아직 글이 없습니다.</p>';
    box.querySelector('.post-card')?.classList.add('is-featured');
    if (pages.length) {
      $('#custom-pages-section').hidden = false;
      $('#custom-pages').innerHTML = pages.map((p) =>
        `<a class="page-card" href="#/page/${p.id}">${escapeHtml(p.title)}</a>`).join('');
    }
    initReveal();
  } catch (e) { dbError(e); }
}

/* ===== 페이지: 게시판 ===== */
async function pageBoard(category) {
  render('tpl-board');
  let posts, boardNames, boardFx;
  try {
    [posts, boardNames, boardFx] = await Promise.all([
      db.getPosts(), db.getBoards(), db.getSetting('board_fx'),
    ]);
  } catch (e) { dbError(e); return; }
  if (!$('#category-list')) return; // 페이지 이동됨

  const counts = {};
  posts.forEach((p) => {
    const c = p.category || '미분류';
    counts[c] = (counts[c] || 0) + 1;
  });
  const boards = [...new Set([...boardNames, ...Object.keys(counts)])];
  const delBtn = (c) => admin.isLoggedIn()
    ? `<button type="button" class="btn-del-board" data-board="${escapeHtml(c)}" title="게시판 삭제">×</button>` : '';
  $('#category-list').innerHTML =
    `<li><a href="#/board" class="${!category ? 'active' : ''}">전체 <span class="cat-count">${posts.length}</span></a></li>` +
    boards.map((c) =>
      `<li><a href="#/board/${encodeURIComponent(c)}" class="${category === c ? 'active' : ''}">${escapeHtml(c)} <span class="cat-count">${counts[c] || 0}</span></a>${delBtn(c)}</li>`
    ).join('');

  if (category) $('#board-title').textContent = category;

  $('#btn-add-board').addEventListener('click', async () => {
    if (!admin.isLoggedIn()) return;
    const name = prompt('새 게시판 이름을 입력하세요');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (boards.includes(trimmed)) { alert('이미 있는 게시판입니다.'); return; }
    try { await db.addBoard(trimmed); } catch (e) { dbError(e); return; }
    pageBoard(category);
  });

  $('#category-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-del-board');
    if (!btn || !admin.isLoggedIn()) return;
    e.preventDefault();
    const name = btn.dataset.board;
    const inUse = counts[name] || 0;
    if (inUse) {
      if (!confirm(`'${name}' 게시판에 글이 ${inUse}개 있습니다. 게시판을 삭제하면 글은 '미분류'로 이동합니다. 삭제할까요?`)) return;
    } else if (!confirm(`'${name}' 게시판을 삭제할까요?`)) return;
    try { await db.deleteBoard(name); } catch (e2) { dbError(e2); return; }
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
    // 게시판별 등장 효과: 저장된 효과가 있으면 기본 리빌 대신 적용
    const fx = boardFx[category || '전체'] || 'rise';
    if (fx !== 'rise' && !reduceMotion.matches) {
      $('#board-posts').querySelectorAll('.post-item').forEach((el, i) => {
        el.classList.add('no-reveal'); // 기본 리빌 대신 게시판 효과 사용
        if (fx === 'none') return;
        el.classList.add('fxi', 'fxi-' + fx);
        el.style.setProperty('--fxi-delay', `${Math.min(i, 6) * 70}ms`);
        safeObserve(el);
      });
    }
    initReveal();
  };
  draw('');
  $('#search-input').addEventListener('input', (e) => draw(e.target.value.trim()));
}

/* ===== 페이지: 글쓰기 / 수정 (관리자 전용) — isPage=true면 커스텀 페이지 작성 ===== */
async function pageWrite(editId, isPage = false) {
  if (!admin.isLoggedIn()) {
    const ok = await admin.login();
    applyAdminUI();
    if (ok) pageWrite(editId, isPage);
    else location.hash = '#/';
    return;
  }
  render('tpl-write');
  let editing = null, boardNames = [], posts = [];
  try {
    if (isPage) {
      if (editId) {
        editing = await db.getPage(editId);
        if (!editing) { location.hash = '#/'; return; }
        if (parseBuilderContent(editing.content)) { location.hash = '#/pagebuild/' + editId; return; }
      }
    } else {
      [boardNames, posts] = await Promise.all([db.getBoards(), db.getPosts()]);
      if (editId) {
        editing = await db.getPost(editId);
        if (!editing) { location.hash = '#/board'; return; }
      }
    }
  } catch (e) { dbError(e); return; }
  if (!$('#write-form')) return;

  const editor = $('#editor');
  const htmlSrc = $('#html-source');
  let mode = 'editor';

  if (isPage) {
    // 페이지에는 게시판 분류 없음
    $('#post-category').closest('.field').hidden = true;
    $('#write-title').textContent = editing ? '페이지 수정' : '새 페이지';
  } else {
    $('#category-options').innerHTML =
      [...new Set([...boardNames, ...posts.map((p) => p.category).filter(Boolean)])]
        .map((c) => `<option value="${escapeHtml(c)}">`).join('');
  }

  if (editing) {
    if (!isPage) {
      $('#write-title').textContent = '글 수정';
      $('#post-category').value = editing.category || '';
    }
    $('#post-title').value = editing.title;
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

  $('#write-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = mode === 'html' ? htmlSrc.value : editor.innerHTML;
    if (!content.trim()) { alert('본문을 입력하세요.'); return; }
    const payload = {
      title: $('#post-title').value.trim(),
      category: $('#post-category').value.trim(),
      content,
    };
    try {
      if (isPage) {
        if (editing) {
          await db.updatePage(editing.id, payload);
          location.hash = '#/page/' + editing.id;
        } else {
          const newId = await db.createPage(payload);
          location.hash = '#/page/' + newId;
        }
      } else if (editing) {
        await db.updatePost(editing.id, payload);
        location.hash = '#/post/' + editing.id;
      } else {
        const newId = await db.createPost(payload);
        location.hash = '#/post/' + newId;
      }
    } catch (e2) { dbError(e2); }
  });
}

/* ===== 페이지: 글 보기 + 댓글 ===== */
async function pagePost(id) {
  let post;
  try { post = await db.getPost(id); } catch (e) { dbError(e); return; }
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
  $('#btn-delete-post').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!admin.isLoggedIn() || !confirm('이 글을 삭제할까요?')) return;
    try { await db.deletePost(id); } catch (e2) { dbError(e2); return; }
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
      name,
      pwHash: await sha256(pw),
      secret,
      spam: isSpam(body),
    };
    if (secret) {
      // 비밀댓글: 본문+사진 묶어서 암호화
      comment.encrypted = await encryptText(JSON.stringify({ body, photo: pendingPhoto }), pw);
    } else {
      comment.body = body;
      if (pendingPhoto) comment.photo = pendingPhoto;
    }

    try {
      await db.addComment(id, comment);
    } catch (e2) { dbError(e2); return; }
    e.target.reset();
    clearPhoto();
    alert(comment.spam
      ? '스팸으로 분류되어 관리자 확인 후 공개됩니다.'
      : '댓글이 등록되었습니다. 관리자 승인 후 공개됩니다.');
    drawComments(id);
  });
}

async function drawComments(postId) {
  let all;
  try { all = await db.getComments(postId); } catch (e) { dbError(e); return; }
  const list = $('#comment-list');
  if (!list) return; // 페이지 이동됨
  const isAdmin = admin.isLoggedIn();
  // RLS로 비관리자는 승인된 댓글만 내려옴 — 클라이언트 필터는 이중 안전장치
  const comments = isAdmin ? all : all.filter((c) => c.approved);
  $('#comment-count').textContent = comments.length;

  const statusBadge = (c) => {
    if (!isAdmin || c.approved) return '';
    return c.spam
      ? '<span class="badge badge-spam">스팸 의심</span>'
      : '<span class="badge badge-pending">승인 대기</span>';
  };
  const adminActions = (c) => {
    if (!isAdmin) return '';
    const approve = !c.approved ? '<a href="#" class="btn-approve">승인</a>' : '';
    return `${approve}<a href="#" class="btn-admin-del">삭제(관리자)</a>`;
  };

  list.innerHTML = comments.map((c) => `
    <li class="comment-item ${!c.approved ? 'is-pending' : ''}" data-id="${c.id}">
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
      const pw = prompt('댓글 비밀번호를 입력하세요');
      if (pw === null) return;
      try {
        const ok = await db.deleteCommentWithPw(item.dataset.id, await sha256(pw));
        if (!ok) { alert('비밀번호가 일치하지 않습니다.'); return; }
      } catch (e2) { dbError(e2); return; }
      drawComments(postId);
    });
  });

  list.querySelectorAll('.btn-approve').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!admin.isLoggedIn()) return;
      try { await db.approveComment(btn.closest('.comment-item').dataset.id); } catch (e2) { dbError(e2); return; }
      drawComments(postId);
    });
  });

  list.querySelectorAll('.btn-admin-del').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!admin.isLoggedIn() || !confirm('이 댓글을 삭제할까요?')) return;
      try { await db.deleteCommentAdmin(btn.closest('.comment-item').dataset.id); } catch (e2) { dbError(e2); return; }
      drawComments(postId);
    });
  });
}

/* ===== 디자인 페이지 (블록 조립) ===== */
const BLOCK_DEFAULTS = {
  hero: { img: 'https://picsum.photos/seed/build-hero/1920/900', eyebrow: 'A PERSONAL ARCHIVE', title: '제목을 입력하세요', btnText: '', btnLink: '' },
  intro: { label: 'THE ARCHIVE', text: '소개 문단을 입력하세요.' },
  split: { img: 'https://picsum.photos/seed/build-split/1000/750', num: '01 — 소제목', title: '제목을 입력하세요', body: '내용을 입력하세요.', reverse: false },
  banner: { img: 'https://picsum.photos/seed/build-band/1920/700', quote: '인용구를 입력하세요.' },
};
const BLOCK_NAMES = { hero: '히어로', intro: '소개 문단', split: '이미지 + 글', banner: '인용 배너' };

function parseBuilderContent(content) {
  try {
    const j = JSON.parse(content);
    if (j && Array.isArray(j.blocks)) return j.blocks;
  } catch { /* 일반 HTML 페이지 */ }
  return null;
}

/* 블록 배열 → 메인 화면과 동일한 마크업 */
function blocksHtml(blocks) {
  return blocks.map((b) => {
    if (b.type === 'hero') {
      const btn = b.btnText ? `<a href="${escapeHtml(b.btnLink || '#')}" class="btn-pill">${escapeHtml(b.btnText)}</a>` : '';
      return `<section class="hero-full">
        <img src="${escapeHtml(b.img)}" alt="" loading="eager">
        <div class="hero-overlay">
          ${b.eyebrow ? `<p class="hero-eyebrow">${escapeHtml(b.eyebrow)}</p>` : ''}
          <h1>${escapeHtml(b.title)}</h1>
          ${btn}
        </div>
      </section>`;
    }
    if (b.type === 'intro') {
      return `<section class="intro-split">
        <span class="intro-label">${escapeHtml(b.label)}</span>
        <p class="intro-text">${escapeHtml(b.text)}</p>
      </section>`;
    }
    if (b.type === 'split') {
      return `<section class="alt-row ${b.reverse ? 'alt-reverse' : ''}">
        <div class="alt-media"><img src="${escapeHtml(b.img)}" alt="" loading="lazy"></div>
        <div class="alt-body">
          ${b.num ? `<span class="feature-num">${escapeHtml(b.num)}</span>` : ''}
          <h2>${escapeHtml(b.title)}</h2>
          <p>${escapeHtml(b.body)}</p>
        </div>
      </section>`;
    }
    if (b.type === 'banner') {
      return `<section class="interstitial">
        <img src="${escapeHtml(b.img)}" alt="" loading="lazy">
        <p class="interstitial-quote">${escapeHtml(b.quote)}</p>
      </section>`;
    }
    return '';
  }).join('');
}

/* ===== 페이지: 디자인 페이지 빌더 (관리자) ===== */
async function pageBuild(editId) {
  if (!admin.isLoggedIn()) {
    const ok = await admin.login();
    applyAdminUI();
    if (ok) pageBuild(editId);
    else location.hash = '#/';
    return;
  }
  render('tpl-pagebuild');
  let editing = null;
  if (editId) {
    try { editing = await db.getPage(editId); } catch (e) { dbError(e); return; }
    if (!editing) { location.hash = '#/settings'; return; }
    $('#build-title').textContent = '디자인 페이지 수정';
    $('#build-page-title').value = editing.title;
  }
  const blocks = editing ? (parseBuilderContent(editing.content) || []) : [{ type: 'hero', ...BLOCK_DEFAULTS.hero }];

  const fieldHtml = (b, i) => {
    if (b.type === 'hero') {
      return `<div class="field"><label>배경 사진</label>${imgField(b.img)}</div>
        <div class="field"><label>작은 문구 (선택)</label><input data-k="eyebrow" value="${escapeHtml(b.eyebrow)}"></div>
        <div class="field"><label>큰 제목</label><input data-k="title" value="${escapeHtml(b.title)}"></div>
        <div class="field-row">
          <div class="field"><label>버튼 문구 (선택)</label><input data-k="btnText" value="${escapeHtml(b.btnText)}"></div>
          <div class="field"><label>버튼 링크</label><input data-k="btnLink" value="${escapeHtml(b.btnLink)}" placeholder="#/board"></div>
        </div>`;
    }
    if (b.type === 'intro') {
      return `<div class="field"><label>라벨</label><input data-k="label" value="${escapeHtml(b.label)}"></div>
        <div class="field"><label>문단</label><textarea data-k="text" rows="3">${escapeHtml(b.text)}</textarea></div>`;
    }
    if (b.type === 'split') {
      return `<div class="field"><label>사진</label>${imgField(b.img)}</div>
        <div class="field"><label>번호 문구 (선택)</label><input data-k="num" value="${escapeHtml(b.num)}"></div>
        <div class="field"><label>제목</label><input data-k="title" value="${escapeHtml(b.title)}"></div>
        <div class="field"><label>내용</label><textarea data-k="body" rows="3">${escapeHtml(b.body)}</textarea></div>
        <label class="secret-label"><input type="checkbox" data-k="reverse" ${b.reverse ? 'checked' : ''}> 사진을 오른쪽에</label>`;
    }
    if (b.type === 'banner') {
      return `<div class="field"><label>배경 사진</label>${imgField(b.img)}</div>
        <div class="field"><label>인용구</label><textarea data-k="quote" rows="2">${escapeHtml(b.quote)}</textarea></div>`;
    }
    return '';
  };
  const imgField = (src) => `<div class="build-img-row">
      <img class="build-img-preview" src="${escapeHtml(src)}" alt="">
      <input data-k="img" value="${escapeHtml(src)}" placeholder="이미지 URL">
      <button type="button" class="btn-attach build-upload">업로드</button>
      <input type="file" class="build-file" accept="image/*" hidden>
    </div>`;

  const drawBlocks = () => {
    $('#block-list').innerHTML = blocks.map((b, i) => `
      <div class="block-card" data-i="${i}">
        <div class="block-head">
          <strong>${BLOCK_NAMES[b.type]}</strong>
          <span class="block-tools">
            <button type="button" class="btn-attach block-up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn-attach block-down" ${i === blocks.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn-attach block-del">삭제</button>
          </span>
        </div>
        ${fieldHtml(b, i)}
      </div>`).join('');
  };
  drawBlocks();

  $('#block-list').addEventListener('input', (e) => {
    const card = e.target.closest('.block-card');
    const k = e.target.dataset.k;
    if (!card || !k) return;
    const b = blocks[+card.dataset.i];
    b[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'img') card.querySelector('.build-img-preview').src = e.target.value || 'https://picsum.photos/seed/blank/400/300';
  });
  $('#block-list').addEventListener('click', async (e) => {
    const card = e.target.closest('.block-card');
    if (!card) return;
    const i = +card.dataset.i;
    if (e.target.closest('.block-del')) { blocks.splice(i, 1); drawBlocks(); return; }
    if (e.target.closest('.block-up') && i > 0) { [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]]; drawBlocks(); return; }
    if (e.target.closest('.block-down') && i < blocks.length - 1) { [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]]; drawBlocks(); return; }
    if (e.target.closest('.build-upload')) card.querySelector('.build-file').click();
  });
  $('#block-list').addEventListener('change', async (e) => {
    if (!e.target.classList.contains('build-file') || !e.target.files[0]) return;
    const card = e.target.closest('.block-card');
    try {
      const dataUrl = await compressImage(e.target.files[0], 1600, 0.8);
      blocks[+card.dataset.i].img = dataUrl;
      card.querySelector('.build-img-preview').src = dataUrl;
      card.querySelector('input[data-k="img"]').value = '';
    } catch { alert('이미지 파일인지 확인하세요.'); }
    e.target.value = '';
  });

  $('.block-add-bar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-add]');
    if (!t) return;
    blocks.push({ type: t.dataset.add, ...BLOCK_DEFAULTS[t.dataset.add] });
    drawBlocks();
    $('#block-list').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#btn-save-build').addEventListener('click', async () => {
    const title = $('#build-page-title').value.trim();
    if (!title) { alert('페이지 제목을 입력하세요.'); return; }
    if (!blocks.length) { alert('블록을 하나 이상 추가하세요.'); return; }
    const payload = { title, content: JSON.stringify({ blocks }) };
    try {
      if (editing) {
        await db.updatePage(editing.id, payload);
        location.hash = '#/page/' + editing.id;
      } else {
        const newId = await db.createPage(payload);
        location.hash = '#/page/' + newId;
      }
    } catch (e) { dbError(e); }
  });
}

/* ===== 페이지: 커스텀 페이지 보기 ===== */
async function pageView(id) {
  let page;
  try { page = await db.getPage(id); } catch (e) { dbError(e); return; }
  if (!page) { location.hash = '#/'; return; }

  const blocks = parseBuilderContent(page.content);
  if (blocks) {
    // 디자인 페이지: 메인 화면과 동일한 풀폭 레이아웃
    app.innerHTML = `<div class="build-admin-bar admin-only" hidden>
        <span>${escapeHtml(page.title)}</span>
        <span class="meta-actions"><a href="#/pagebuild/${page.id}">수정</a> <a href="#" id="btn-delete-page">삭제</a></span>
      </div>` + blocksHtml(blocks);
    applyAdminUI();
    $('#btn-delete-page')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!admin.isLoggedIn() || !confirm('이 페이지를 삭제할까요?')) return;
      try { await db.deletePage(id); } catch (e2) { dbError(e2); return; }
      location.hash = '#/';
    });
    initReveal();
    return;
  }

  render('tpl-page');
  $('#page-title').textContent = page.title;
  $('#page-date').textContent = fmtDate(page.createdAt);
  $('#page-content').innerHTML = page.content; // 관리자 본인 HTML — 그대로 렌더

  $('#btn-edit-page').addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = '#/pagewrite/' + page.id;
  });
  $('#btn-delete-page').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!admin.isLoggedIn() || !confirm('이 페이지를 삭제할까요?')) return;
    try { await db.deletePage(id); } catch (e2) { dbError(e2); return; }
    location.hash = '#/';
  });
}

/* ===== 페이지: 화면 설정 (관리자) ===== */
async function pageSettings() {
  if (!admin.isLoggedIn()) { location.hash = '#/'; return; }
  render('tpl-settings');
  let saved, savedFx, boardNames, posts, pages;
  try {
    [saved, savedFx, boardNames, posts, pages] = await Promise.all([
      db.getSetting('site_images'), db.getSetting('board_fx'), db.getBoards(), db.getPosts(), db.getPages(),
    ]);
  } catch (e) { dbError(e); return; }
  if (!$('#slot-list')) return;

  // 페이지 관리
  $('#page-manage-list').innerHTML = pages.length
    ? pages.map((p) => `<div class="page-manage-row" data-id="${p.id}">
        <a href="#/page/${p.id}" class="page-manage-title">${escapeHtml(p.title)}</a>
        <span class="page-manage-date">${fmtDate(p.createdAt)}</span>
        <a href="#/pagewrite/${p.id}" class="btn-attach">수정</a>
        <button type="button" class="btn-attach btn-del-page">삭제</button>
      </div>`).join('')
    : '<p class="empty-msg">아직 페이지가 없습니다.</p>';
  $('#btn-new-page').addEventListener('click', () => { location.hash = '#/pagewrite'; });
  $('#btn-new-build').addEventListener('click', () => { location.hash = '#/pagebuild'; });
  $('#page-manage-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-del-page');
    if (!btn) return;
    const row = btn.closest('.page-manage-row');
    if (!confirm('이 페이지를 삭제할까요?')) return;
    try { await db.deletePage(row.dataset.id); } catch (e2) { dbError(e2); return; }
    row.remove();
  });

  const draft = {};
  IMAGE_SLOTS.forEach((s) => {
    draft[s.key] = { src: saved[s.key]?.src || '', fx: saved[s.key]?.fx || 'none' };
  });

  $('#slot-list').innerHTML = IMAGE_SLOTS.map((s) => {
    const conf = draft[s.key];
    const options = IMAGE_FX.map((f) =>
      `<option value="${f.key}" ${conf.fx === f.key ? 'selected' : ''}>${f.label}</option>`).join('');
    return `<div class="slot-card" data-key="${s.key}">
      <div class="slot-preview"><img src="${conf.src || s.src}" alt=""></div>
      <div class="slot-fields">
        <h3>${s.label}</h3>
        <div class="field">
          <label>이미지 URL (비우면 기본 사진)</label>
          <input type="url" class="slot-url" value="${escapeHtml(conf.src)}" placeholder="${s.src}">
        </div>
        <div class="slot-row">
          <button type="button" class="btn-attach slot-upload">파일 업로드</button>
          <input type="file" class="slot-file" accept="image/*" hidden>
          <select class="slot-fx">${options}</select>
        </div>
      </div>
    </div>`;
  }).join('');

  $('#slot-list').addEventListener('click', (e) => {
    const card = e.target.closest('.slot-card');
    if (!card) return;
    if (e.target.closest('.slot-upload')) card.querySelector('.slot-file').click();
  });
  $('#slot-list').addEventListener('change', async (e) => {
    const card = e.target.closest('.slot-card');
    if (!card) return;
    const key = card.dataset.key;
    if (e.target.classList.contains('slot-file') && e.target.files[0]) {
      try {
        const dataUrl = await compressImage(e.target.files[0], 1600, 0.8);
        draft[key].src = dataUrl;
        card.querySelector('.slot-url').value = '';
        card.querySelector('.slot-preview img').src = dataUrl;
      } catch { alert('이미지 파일인지 확인하세요.'); }
      e.target.value = '';
    } else if (e.target.classList.contains('slot-url')) {
      draft[key].src = e.target.value.trim();
      const def = IMAGE_SLOTS.find((s) => s.key === key).src;
      card.querySelector('.slot-preview img').src = draft[key].src || def;
    } else if (e.target.classList.contains('slot-fx')) {
      draft[key].fx = e.target.value;
    }
  });

  // 게시판별 등장 효과
  const postCats = [...new Set(posts.map((p) => p.category || '미분류'))];
  const fxBoards = ['전체', ...new Set([...boardNames, ...postCats])];
  const draftFx = {};
  fxBoards.forEach((b) => { draftFx[b] = savedFx[b] || 'rise'; });

  $('#board-fx-list').innerHTML = fxBoards.map((b) => {
    const options = BOARD_FX.map((f) =>
      `<option value="${f.key}" ${draftFx[b] === f.key ? 'selected' : ''}>${f.label}</option>`).join('');
    return `<div class="fx-row" data-board="${escapeHtml(b)}">
      <span class="fx-board-name">${escapeHtml(b)}</span>
      <select class="slot-fx board-fx-sel">${options}</select>
      <button type="button" class="btn-attach btn-fx-preview">미리보기</button>
      <div class="fx-sample"><span class="fx-sample-bar"></span><span class="fx-sample-line"></span></div>
    </div>`;
  }).join('');

  $('#board-fx-list').addEventListener('change', (e) => {
    if (!e.target.classList.contains('board-fx-sel')) return;
    draftFx[e.target.closest('.fx-row').dataset.board] = e.target.value;
  });
  $('#board-fx-list').addEventListener('click', (e) => {
    if (!e.target.closest('.btn-fx-preview')) return;
    const row = e.target.closest('.fx-row');
    const fx = row.querySelector('.board-fx-sel').value;
    const sample = row.querySelector('.fx-sample');
    sample.className = 'fx-sample';
    void sample.offsetWidth; // 리플로 강제 — 애니메이션 재시작
    if (fx === 'none') return;
    const cls = fx === 'rise' ? 'fxi-rise' : 'fxi-' + fx;
    sample.classList.add('fxi', cls);
    requestAnimationFrame(() => requestAnimationFrame(() => sample.classList.add('in-view')));
  });

  $('#btn-save-settings').addEventListener('click', async () => {
    const out = {};
    IMAGE_SLOTS.forEach((s) => {
      const d = draft[s.key];
      if (d.src || d.fx !== 'none') out[s.key] = d;
    });
    const fxOut = {};
    Object.entries(draftFx).forEach(([b, f]) => { if (f !== 'rise') fxOut[b] = f; });
    try {
      await db.setSetting('site_images', out);
      await db.setSetting('board_fx', fxOut);
      alert('저장했습니다.');
      location.hash = '#/';
    } catch (e) { dbError(e); }
  });
  $('#btn-reset-settings').addEventListener('click', async () => {
    if (!confirm('모든 사진과 효과를 기본값으로 되돌릴까요?')) return;
    try {
      await db.setSetting('site_images', {});
      await db.setSetting('board_fx', {});
    } catch (e) { dbError(e); return; }
    alert('기본값으로 되돌렸습니다.');
    location.hash = '#/';
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
  } else if (parts[0] === 'page') {
    pageView(parts[1]);
  } else if (parts[0] === 'pagewrite') {
    pageWrite(parts[1] || null, true);
  } else if (parts[0] === 'pagebuild') {
    pageBuild(parts[1] || null);
  } else if (parts[0] === 'settings') {
    $('[data-nav="settings"]')?.classList.add('active');
    pageSettings();
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
    await admin.logout();
  } else {
    await admin.login();
  }
  route();
});

/* 부팅: 세션 복원 후 첫 라우트 */
showLoading();
sb.auth.getSession().then(({ data }) => {
  adminOn = !!data.session;
  route();
});

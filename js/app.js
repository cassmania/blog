/* 丕刀卜己卜人丨廿卜 blog — GitHub Pages 정적 블로그 + Supabase 백엔드
   글·댓글·게시판·설정 전부 Supabase DB 저장 — 모든 방문자가 같은 내용을 봄.
   비밀댓글: Web Crypto AES-GCM 암호화. 관리자: Supabase Auth 이메일 로그인. */

const APP_VERSION = '14';
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

/* 사진 업로드: 압축 후 Supabase Storage에 올려 URL 반환 (용량 제한 해결)
   Storage 실패 시 data URL로 폴백 */
async function uploadPhoto(file, maxW = 1600, quality = 0.8) {
  const dataUrl = await compressImage(file, maxW, quality);
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn('Storage 업로드 실패 — data URL로 저장:', e?.message);
    return dataUrl;
  }
}

function render(tplId) {
  app.innerHTML = '';
  app.appendChild($('#' + tplId).content.cloneNode(true));
  applyAdminUI();
}

function showLoading() {
  app.innerHTML = '<p class="empty-msg loading-msg">불러오는 중…</p>';
}

/* 스크롤 리빌 — 기본은 시스템 '애니메이션 끄기' 존중, 설정에서 '항상 재생' 선택 가능 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionBlocked = () => reduceMotion.matches && !document.body.classList.contains('fx-force');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) {
      // rAF: 숨김 상태가 먼저 페인트된 뒤 전환 시작 — 즉시 붙이면 애니메이션이 스킵됨
      requestAnimationFrame(() => en.target.classList.add('in-view'));
      revealObserver.unobserve(en.target);
    }
  });
}, { threshold: 0.12 });

/* 관찰 + 안전장치: IO가 안 도는 환경에서도 타이머가 화면 안 요소를 계속 검사해 반드시 재생 */
const pendingFx = new Set();
function safeObserve(el) {
  void el.offsetWidth; // 리플로 강제 — 초기 숨김 상태를 확정해 전환이 반드시 재생되게
  revealObserver.observe(el);
  pendingFx.add(el);
}
setInterval(() => {
  pendingFx.forEach((el) => {
    if (!el.isConnected) { pendingFx.delete(el); return; }
    if (el.classList.contains('in-view')) { pendingFx.delete(el); return; }
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.95 && r.bottom > 0) {
      el.classList.add('in-view');
      pendingFx.delete(el);
      revealObserver.unobserve(el);
    }
  });
}, 350);

function initReveal() {
  if (motionBlocked()) return;
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
    if (fx === 'none' || motionBlocked()) return;
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
  const nav = navToken;
  render('tpl-home');
  try {
    const [posts, images, pages, home, texts] = await Promise.all([
      db.getPosts(), db.getSetting('site_images'), db.getPages(), db.getSetting('home_blocks'),
      db.getSetting('home_texts'),
    ]);
    if (nav !== navToken) return; // 이동 중 다른 라우트로 바뀜 — 낡은 렌더 중단
    applySiteImages(images);
    applyHomeTexts(texts);
    if (Array.isArray(home.blocks) && home.blocks.length) {
      // 블록별 배치 위치(anchor)에 따라 기본 화면 사이사이에 삽입
      home.blocks.forEach((b, i) => { b.__bid = i; });
      lastHomeBlocks = home.blocks;
      const legacyAnchor = home.position === 'top' ? 'top' : 'end';
      const groups = {};
      home.blocks.forEach((b) => {
        const a = b.anchor || legacyAnchor;
        (groups[a] = groups[a] || []).push(b);
      });
      const refSel = {
        hero: '.hero-full', intro: '.intro-split',
        f1: '.alt-row:not(.alt-reverse)', f2: '.alt-reverse', banner: '.interstitial',
      };
      Object.entries(groups).forEach(([a, list]) => {
        const html = blocksHtml(list);
        if (a === 'top') { app.insertAdjacentHTML('afterbegin', html); return; }
        if (a === 'bottom') { app.insertAdjacentHTML('beforeend', html); return; }
        const ref = refSel[a] ? app.querySelector(refSel[a]) : null;
        if (ref) ref.insertAdjacentHTML('afterend', html);
        else $('#custom-pages-section').insertAdjacentHTML('beforebegin', html); // end 또는 기준 없음
      });
      applyBlockFx();
    }
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
    if (fx !== 'rise' && !motionBlocked()) {
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

  // 글자색·크기 (선택한 부분에 적용)
  $('#font-color').addEventListener('input', (e) => {
    editor.focus();
    document.execCommand('foreColor', false, e.target.value);
  });
  $('#font-size').addEventListener('change', (e) => {
    if (!e.target.value) return;
    editor.focus();
    document.execCommand('fontSize', false, e.target.value);
    e.target.selectedIndex = 0;
  });

  // HTML 모드 실시간 미리보기
  const pv = $('#html-preview');
  const pvBtn = $('#btn-html-preview');
  pvBtn.addEventListener('click', () => {
    pv.hidden = !pv.hidden;
    pvBtn.textContent = pv.hidden ? '미리보기 켜기' : '미리보기 끄기';
    if (!pv.hidden) pv.innerHTML = htmlSrc.value; // 관리자 본인 HTML
  });
  htmlSrc.addEventListener('input', () => {
    if (!pv.hidden) pv.innerHTML = htmlSrc.value;
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
        const dataUrl = await uploadPhoto(file);
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
  hero: { img: 'https://picsum.photos/seed/build-hero/1920/900', eyebrow: 'A PERSONAL ARCHIVE', title: '제목을 입력하세요', btnText: '', btnLink: '', fx: 'fade', speed: 'normal' },
  intro: { label: 'THE ARCHIVE', text: '소개 문단을 입력하세요.', fx: 'fade', speed: 'normal' },
  split: { img: 'https://picsum.photos/seed/build-split/1000/750', num: '01 — 소제목', title: '제목을 입력하세요', body: '내용을 입력하세요.', reverse: false, fx: 'rise', speed: 'normal' },
  banner: { img: 'https://picsum.photos/seed/build-band/1920/700', quote: '인용구를 입력하세요.', fx: 'fade', speed: 'normal' },
  photo: { img: 'https://picsum.photos/seed/build-photo/1600/900', caption: '', fx: 'fade', speed: 'normal' },
  gallery: { imgs: [], cols: '3', ratio: '1', fx: 'fade', speed: 'normal' },
  slideshow: { imgs: [], interval: '4', height: 'm', fx: 'fade', speed: 'normal' },
};
const BLOCK_NAMES = { hero: '히어로', intro: '소개 문단', split: '이미지 + 글', banner: '인용 배너', photo: '사진', gallery: '사진 갤러리', slideshow: '슬라이드쇼' };

/* 기본 홈 문구 (설정에서 덮어쓰기) */
const HOME_TEXTS = [
  { key: 'heroEyebrow', label: '히어로 작은 문구', sel: '.hero-eyebrow', def: 'A PERSONAL ARCHIVE' },
  { key: 'heroTitle', label: '히어로 큰 제목', sel: '.hero-full h1', def: '기록은 생각을\n단단하게 만든다', multi: true },
  { key: 'introLabel', label: '소개 라벨', sel: '.intro-label', def: 'THE ARCHIVE' },
  { key: 'introText', label: '소개 문단', sel: '.intro-text', def: '이곳은 흘러가는 것들을 붙잡아 두는 공간입니다. 일상과 공부, 프로젝트의 기록이 쌓여 하나의 아카이브가 됩니다. 불필요한 것을 덜어내고, 글과 사진에만 집중합니다.', multi: true },
  { key: 'f1num', label: '01 섹션 번호 문구', sel: '.alt-row:not(.alt-reverse) .feature-num', def: '01 — 기록' },
  { key: 'f1title', label: '01 섹션 제목', sel: '.alt-row:not(.alt-reverse) h2', def: '짧아도 좋고,\n길어도 좋습니다', multi: true },
  { key: 'f1body', label: '01 섹션 내용', sel: '.alt-row:not(.alt-reverse) .alt-body p', def: '리치텍스트 에디터와 HTML 모드, 사진 첨부까지. 형식에 얽매이지 않고 그날의 생각을 그대로 남깁니다.', multi: true },
  { key: 'f2num', label: '02 섹션 번호 문구', sel: '.alt-reverse .feature-num', def: '02 — 대화' },
  { key: 'f2title', label: '02 섹션 제목', sel: '.alt-reverse h2', def: '사진과 함께\n생각을 나눕니다', multi: true },
  { key: 'f2body', label: '02 섹션 내용', sel: '.alt-reverse .alt-body p', def: '누구나 댓글에 사진을 첨부해 순간을 공유할 수 있습니다. 조용히 남기고 싶다면 비밀댓글로 — 암호화되어 저장됩니다.', multi: true },
  { key: 'bannerQuote', label: '중간 배너 인용구', sel: '.interstitial-quote', def: '여백을 껴안고,\n단순함 속에서 명료함을 찾다.', multi: true },
];

function applyHomeTexts(saved) {
  HOME_TEXTS.forEach((t) => {
    const v = saved[t.key];
    if (!v) return;
    const el = app.querySelector(t.sel);
    if (el) el.innerHTML = escapeHtml(v).replace(/\n/g, '<br>');
  });
}

/* 블록 등장 효과 + 속도 */
const BLOCK_FX = [
  { key: 'none', label: '없음' },
  { key: 'fade', label: '페이드' },
  { key: 'rise', label: '슬라이드 ↑ (아래에서)' },
  { key: 'down', label: '슬라이드 ↓ (위에서)' },
  { key: 'left', label: '슬라이드 → (왼쪽에서)' },
  { key: 'right', label: '슬라이드 ← (오른쪽에서)' },
  { key: 'pop', label: '팝 (뿅 커짐)' },
  { key: 'zoom', label: '줌 (살짝 커짐)' },
  { key: 'flip', label: '플립 (기울며)' },
  { key: 'rotate', label: '로테이트 (회전하며)' },
  { key: 'blur', label: '블러 (흐림에서 선명)' },
];
const BLOCK_SPEEDS = [
  { key: 'slow', label: '느리게', dur: '1.2s' },
  { key: 'normal', label: '보통', dur: '0.65s' },
  { key: 'fast', label: '빠르게', dur: '0.35s' },
];
const speedDur = (k) => (BLOCK_SPEEDS.find((s) => s.key === k) || BLOCK_SPEEDS[1]).dur;

/* 홈 블록 배치 지점 */
const HOME_ANCHORS = [
  { key: 'top', label: '맨 위 (히어로 위)' },
  { key: 'hero', label: '히어로 아래' },
  { key: 'intro', label: '소개 문단 아래' },
  { key: 'f1', label: '01 섹션 아래' },
  { key: 'f2', label: '02 섹션 아래' },
  { key: 'banner', label: '중간 배너 아래' },
  { key: 'end', label: '기본 화면 아래 (기본)' },
  { key: 'bottom', label: '맨 아래 (최근 글 아래)' },
];

/* 블록 폭·정렬 (구버전 full/mid/narrow + 드래그 리사이즈의 임의 % 값 지원) */
function sizeCls(b) {
  const map = { full: '', 100: '', mid: ' w-70', 70: ' w-70', narrow: ' w-50', 50: ' w-50', 35: ' w-35' };
  let w = map[b.width];
  if (w === undefined) w = /^\d+$/.test(b.width) ? ' w-pct' : '';
  const al = b.align === 'left' ? ' al-left' : b.align === 'right' ? ' al-right' : '';
  return w + al;
}
function sizeStyle(b) {
  const known = ['full', '100', 'mid', '70', 'narrow', '50', '35'];
  if (b.width && /^\d+$/.test(b.width) && !known.includes(String(b.width))) {
    return ` style="max-width:${Math.max(20, Math.min(100, +b.width))}%"`;
  }
  return '';
}

/* 렌더된 블록에 선택한 효과 적용 */
function applyBlockFx(root = app) {
  root.querySelectorAll('[data-fx]').forEach((el) => {
    el.classList.add('no-reveal'); // 기본 리빌 대신 블록 자체 효과
    const fx = el.dataset.fx;
    if (fx === 'none' || motionBlocked()) return;
    // 갤러리: 사진 한 장씩 순차 등장, 나머지: 블록 통째로
    const targets = el.dataset.fxEach ? [...el.children] : [el];
    targets.forEach((t, i) => {
      t.classList.add('fxi', 'fxi-' + fx);
      t.style.setProperty('--fx-dur', el.dataset.dur || '0.65s');
      if (el.dataset.fxEach) t.style.setProperty('--fxi-delay', `${Math.min(i, 12) * 70}ms`);
      safeObserve(t);
    });
  });
  initSlideshows(root);
}

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
    const bid = b.__bid !== undefined ? ` data-bid="${b.__bid}"` : '';
    const fxAttr = `data-fx="${escapeHtml(b.fx || 'none')}" data-dur="${speedDur(b.speed)}"${bid}${sizeStyle(b)}`;
    const w = sizeCls(b);
    if (b.type === 'hero') {
      const btn = b.btnText ? `<a href="${escapeHtml(b.btnLink || '#')}" class="btn-pill">${escapeHtml(b.btnText)}</a>` : '';
      return `<section class="hero-full${w}" ${fxAttr}>
        <img src="${escapeHtml(b.img)}" alt="" loading="eager">
        <div class="hero-overlay">
          ${b.eyebrow ? `<p class="hero-eyebrow">${escapeHtml(b.eyebrow)}</p>` : ''}
          <h1>${escapeHtml(b.title)}</h1>
          ${btn}
        </div>
      </section>`;
    }
    if (b.type === 'intro') {
      return `<section class="intro-split${w}" ${fxAttr}>
        <span class="intro-label">${escapeHtml(b.label)}</span>
        <p class="intro-text">${escapeHtml(b.text)}</p>
      </section>`;
    }
    if (b.type === 'split') {
      return `<section class="alt-row ${b.reverse ? 'alt-reverse' : ''}${w}" ${fxAttr}>
        <div class="alt-media"><img src="${escapeHtml(b.img)}" alt="" loading="lazy"></div>
        <div class="alt-body">
          ${b.num ? `<span class="feature-num">${escapeHtml(b.num)}</span>` : ''}
          <h2>${escapeHtml(b.title)}</h2>
          <p>${escapeHtml(b.body)}</p>
        </div>
      </section>`;
    }
    if (b.type === 'banner') {
      return `<section class="interstitial${w}" ${fxAttr}>
        <img src="${escapeHtml(b.img)}" alt="" loading="lazy">
        <p class="interstitial-quote">${escapeHtml(b.quote)}</p>
      </section>`;
    }
    if (b.type === 'photo') {
      return `<section class="photo-block${w}" ${fxAttr}>
        <img src="${escapeHtml(b.img)}" alt="" loading="lazy">
        ${b.caption ? `<p class="photo-caption">${escapeHtml(b.caption)}</p>` : ''}
      </section>`;
    }
    if (b.type === 'gallery') {
      const cells = (b.imgs || []).map((src) =>
        `<figure class="gal-item"><img src="${escapeHtml(src)}" alt="" loading="lazy"></figure>`).join('');
      return `<section class="gallery-grid cols-${escapeHtml(b.cols || '3')} ratio-${escapeHtml(b.ratio || '1')}${w}" ${fxAttr} data-fx-each="1">${cells}</section>`;
    }
    if (b.type === 'slideshow') {
      const slides = (b.imgs || []).map((src, i) =>
        `<img src="${escapeHtml(src)}" alt="" class="${i === 0 ? 'active' : ''}" loading="${i === 0 ? 'eager' : 'lazy'}">`).join('');
      return `<section class="slideshow-block h-${escapeHtml(b.height || 'm')}${w}" ${fxAttr} data-interval="${(+b.interval || 4) * 1000}">${slides}</section>`;
    }
    return '';
  }).join('');
}

/* 슬라이드쇼 자동 전환 — 라우트 바뀔 때 정리 */
let slideTimers = [];
function initSlideshows(root = app) {
  root.querySelectorAll('.slideshow-block').forEach((box) => {
    const imgs = box.querySelectorAll('img');
    if (imgs.length < 2 || motionBlocked()) return;
    let cur = 0;
    slideTimers.push(setInterval(() => {
      imgs[cur].classList.remove('active');
      cur = (cur + 1) % imgs.length;
      imgs[cur].classList.add('active');
    }, +box.dataset.interval || 4000));
  });
}

/* ===== 페이지: 디자인 페이지 빌더 (관리자) — isHome=true면 홈 화면 편집 ===== */
async function pageBuild(editId, isHome = false) {
  if (!admin.isLoggedIn()) {
    const ok = await admin.login();
    applyAdminUI();
    if (ok) pageBuild(editId, isHome);
    else location.hash = '#/';
    return;
  }
  render('tpl-pagebuild');
  let editing = null;
  let blocks;
  if (isHome) {
    $('#build-title').textContent = '홈 화면 편집';
    $('#build-page-title').closest('.field').hidden = true;
    let saved;
    try { saved = await db.getSetting('home_blocks'); } catch (e) { dbError(e); return; }
    blocks = Array.isArray(saved.blocks) && saved.blocks.length
      ? saved.blocks
      : [{ type: 'slideshow', ...BLOCK_DEFAULTS.slideshow }];
    // 구버전 전체 위치 설정을 블록별 배치 위치로 이관
    const legacyAnchor = saved.position === 'top' ? 'top' : 'end';
    blocks.forEach((b) => { if (!b.anchor) b.anchor = legacyAnchor; });
  } else {
    if (editId) {
      try { editing = await db.getPage(editId); } catch (e) { dbError(e); return; }
      if (!editing) { location.hash = '#/settings'; return; }
      $('#build-title').textContent = '디자인 페이지 수정';
      $('#build-page-title').value = editing.title;
    }
    blocks = editing ? (parseBuilderContent(editing.content) || []) : [{ type: 'hero', ...BLOCK_DEFAULTS.hero }];
  }

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
    if (b.type === 'photo') {
      return `<div class="field"><label>사진</label>${imgField(b.img)}</div>
        <div class="field"><label>설명 문구 (선택)</label><input data-k="caption" value="${escapeHtml(b.caption)}"></div>`;
    }
    if (b.type === 'gallery' || b.type === 'slideshow') {
      const thumbs = (b.imgs || []).map((src, gi) =>
        `<span class="gal-thumb"><img src="${escapeHtml(src)}" alt=""><button type="button" class="gal-del" data-gi="${gi}" title="빼기">×</button></span>`).join('');
      const photosField = `<div class="field">
          <label>사진 ${(b.imgs || []).length}장 — 여러 장 한꺼번에 선택 가능, 무제한</label>
          <div class="gal-thumbs">${thumbs || '<span class="empty-msg">아직 사진이 없습니다.</span>'}</div>
          <div class="slot-row">
            <button type="button" class="btn-attach gal-upload">사진 추가 (여러 장 선택)</button>
            <input type="file" class="gal-file" accept="image/*" multiple hidden>
            <button type="button" class="btn-attach gal-url">URL로 추가</button>
          </div>
        </div>`;
      if (b.type === 'slideshow') {
        return photosField + `<div class="slot-row">
            <label class="tool-label">전환 간격
              <select class="slot-fx" data-k="interval">
                <option value="2" ${b.interval === '2' ? 'selected' : ''}>2초</option>
                <option value="3" ${b.interval === '3' ? 'selected' : ''}>3초</option>
                <option value="4" ${b.interval === '4' || !b.interval ? 'selected' : ''}>4초</option>
                <option value="6" ${b.interval === '6' ? 'selected' : ''}>6초</option>
              </select>
            </label>
            <label class="tool-label">높이
              <select class="slot-fx" data-k="height">
                <option value="s" ${b.height === 's' ? 'selected' : ''}>낮게</option>
                <option value="m" ${b.height === 'm' || !b.height ? 'selected' : ''}>보통</option>
                <option value="l" ${b.height === 'l' ? 'selected' : ''}>높게</option>
              </select>
            </label>
          </div>`;
      }
      return photosField + `<div class="slot-row">
          <label class="tool-label">한 줄에
            <select class="slot-fx" data-k="cols">
              <option value="2" ${b.cols === '2' ? 'selected' : ''}>2장</option>
              <option value="3" ${b.cols === '3' || !b.cols ? 'selected' : ''}>3장</option>
              <option value="4" ${b.cols === '4' ? 'selected' : ''}>4장</option>
            </select>
          </label>
          <label class="tool-label">사진 비율
            <select class="slot-fx" data-k="ratio">
              <option value="1" ${b.ratio === '1' || !b.ratio ? 'selected' : ''}>정사각형</option>
              <option value="43" ${b.ratio === '43' ? 'selected' : ''}>가로 4:3</option>
              <option value="auto" ${b.ratio === 'auto' ? 'selected' : ''}>원본 비율</option>
            </select>
          </label>
        </div>`;
    }
    return '';
  };
  // 모든 블록 공통: 등장 효과 + 속도
  const fxFields = (b) => `<div class="slot-row block-fx-row">
      <label class="tool-label">등장 효과
        <select class="slot-fx" data-k="fx">${BLOCK_FX.map((f) =>
          `<option value="${f.key}" ${(b.fx || 'none') === f.key ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
      </label>
      <label class="tool-label">속도
        <select class="slot-fx" data-k="speed">${BLOCK_SPEEDS.map((s) =>
          `<option value="${s.key}" ${(b.speed || 'normal') === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
      </label>
      <label class="tool-label">크기
        <select class="slot-fx" data-k="width">
          <option value="100" ${!b.width || b.width === 'full' || b.width === '100' ? 'selected' : ''}>전체 (100%)</option>
          <option value="70" ${b.width === 'mid' || b.width === '70' ? 'selected' : ''}>크게 (70%)</option>
          <option value="50" ${b.width === 'narrow' || b.width === '50' ? 'selected' : ''}>절반 (50%)</option>
          <option value="35" ${b.width === '35' ? 'selected' : ''}>작게 (35%)</option>
        </select>
      </label>
      <label class="tool-label">정렬
        <select class="slot-fx" data-k="align">
          <option value="center" ${!b.align || b.align === 'center' ? 'selected' : ''}>가운데</option>
          <option value="left" ${b.align === 'left' ? 'selected' : ''}>왼쪽</option>
          <option value="right" ${b.align === 'right' ? 'selected' : ''}>오른쪽</option>
        </select>
      </label>
      ${isHome ? `<label class="tool-label">배치 위치
        <select class="slot-fx" data-k="anchor">${HOME_ANCHORS.map((a) =>
          `<option value="${a.key}" ${(b.anchor || 'end') === a.key ? 'selected' : ''}>${a.label}</option>`).join('')}</select>
      </label>` : ''}
    </div>`;
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
        ${fxFields(b)}
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
    if (e.target.closest('.gal-upload')) card.querySelector('.gal-file').click();
    const galDel = e.target.closest('.gal-del');
    if (galDel) { blocks[i].imgs.splice(+galDel.dataset.gi, 1); drawBlocks(); return; }
    if (e.target.closest('.gal-url')) {
      const url = prompt('사진 URL을 입력하세요');
      if (url && url.trim()) { blocks[i].imgs.push(url.trim()); drawBlocks(); }
    }
  });
  $('#block-list').addEventListener('change', async (e) => {
    const card = e.target.closest('.block-card');
    if (!card) return;
    if (e.target.classList.contains('build-file') && e.target.files[0]) {
      try {
        const dataUrl = await uploadPhoto(e.target.files[0], 1600, 0.8);
        blocks[+card.dataset.i].img = dataUrl;
        card.querySelector('.build-img-preview').src = dataUrl;
        card.querySelector('input[data-k="img"]').value = '';
      } catch { alert('이미지 파일인지 확인하세요.'); }
      e.target.value = '';
    } else if (e.target.classList.contains('gal-file') && e.target.files.length) {
      // 갤러리: 여러 장 한꺼번에 압축해 추가
      const b = blocks[+card.dataset.i];
      let fail = 0;
      for (const file of e.target.files) {
        try { b.imgs.push(await uploadPhoto(file, 1200, 0.75)); } catch { fail++; }
      }
      if (fail) alert(`${fail}장은 이미지 파일이 아니라 건너뛰었습니다.`);
      e.target.value = '';
      drawBlocks();
    }
  });

  $('.block-add-bar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-add]');
    if (!t) return;
    blocks.push({ type: t.dataset.add, ...BLOCK_DEFAULTS[t.dataset.add] });
    drawBlocks();
    $('#block-list').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#btn-save-build').addEventListener('click', async () => {
    if (!blocks.length) { alert('블록을 하나 이상 추가하세요.'); return; }
    if (JSON.stringify(blocks).length > 8_000_000) {
      alert('사진 용량이 너무 큽니다. 업로드 대신 이미지 URL을 쓰거나 사진 수를 줄이세요.');
      return;
    }
    if (isHome) {
      try {
        await db.setSetting('home_blocks', { blocks });
        location.hash = '#/';
      } catch (e) { dbError(e); }
      return;
    }
    const title = $('#build-page-title').value.trim();
    if (!title) { alert('페이지 제목을 입력하세요.'); return; }
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
    applyBlockFx();
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
  let saved, savedFx, boardNames, posts, pages, siteFx, homeTexts;
  try {
    [saved, savedFx, boardNames, posts, pages, siteFx, homeTexts] = await Promise.all([
      db.getSetting('site_images'), db.getSetting('board_fx'), db.getBoards(), db.getPosts(), db.getPages(),
      db.getSetting('site_fx'), db.getSetting('home_texts'),
    ]);
  } catch (e) { dbError(e); return; }
  if (!$('#slot-list')) return;

  // 기본 홈 문구
  $('#home-text-list').innerHTML = HOME_TEXTS.map((t) => {
    const v = homeTexts[t.key] || '';
    return `<div class="field">
      <label>${t.label}</label>
      ${t.multi
        ? `<textarea data-ht="${t.key}" rows="2" placeholder="${escapeHtml(t.def)}">${escapeHtml(v)}</textarea>`
        : `<input data-ht="${t.key}" value="${escapeHtml(v)}" placeholder="${escapeHtml(t.def)}">`}
    </div>`;
  }).join('');

  // 홈 화면 편집 + 사이트 전역 효과
  $('#btn-edit-home').addEventListener('click', () => { location.hash = '#/homebuild'; });
  $('#btn-reset-home').addEventListener('click', async () => {
    if (!confirm('홈 화면을 기본 디자인으로 되돌릴까요? (조립한 블록 삭제)')) return;
    try { await db.setSetting('home_blocks', {}); } catch (e) { dbError(e); return; }
    alert('기본 홈으로 되돌렸습니다.');
  });
  document.querySelectorAll('#site-fx-list input[data-fx]').forEach((cb) => {
    cb.checked = !!siteFx[cb.dataset.fx];
  });

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
  $('#btn-arrange-home').addEventListener('click', () => { location.hash = '#/homeedit'; });
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
        const dataUrl = await uploadPhoto(e.target.files[0], 1600, 0.8);
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
    const newSiteFx = {};
    document.querySelectorAll('#site-fx-list input[data-fx]').forEach((cb) => {
      if (cb.checked) newSiteFx[cb.dataset.fx] = true;
    });
    const newTexts = {};
    document.querySelectorAll('#home-text-list [data-ht]').forEach((el) => {
      if (el.value.trim()) newTexts[el.dataset.ht] = el.value.trim();
    });
    try {
      await db.setSetting('site_images', out);
      await db.setSetting('board_fx', fxOut);
      await db.setSetting('site_fx', newSiteFx);
      await db.setSetting('home_texts', newTexts);
      applySiteFx(newSiteFx);
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

/* ===== 홈 꾸미기 모드: 드래그 배치 + 모서리 크기 조절 ===== */
let lastHomeBlocks = [];

async function pageHomeEdit() {
  if (!admin.isLoggedIn()) {
    const ok = await admin.login();
    applyAdminUI();
    if (!ok) { location.hash = '#/'; return; }
  }
  await pageHome();
  if (!location.hash.startsWith('#/homeedit')) return;
  if (!lastHomeBlocks.length) {
    alert('배치할 블록이 없습니다. 설정 → 홈 화면 편집에서 먼저 블록을 추가하세요.');
    location.hash = '#/settings';
    return;
  }
  document.body.classList.add('home-editing');
  // bid → 블록 고정 매핑 (드래그로 배열 순서가 바뀌어도 안전)
  const blockByBid = {};
  lastHomeBlocks.forEach((b) => { blockByBid[b.__bid] = b; });
  // 편집 중엔 등장 효과 전부 표시 상태로
  app.querySelectorAll('.fxi').forEach((el) => el.classList.add('in-view'));

  // 블록마다 4모서리 크기 조절 핸들 (드래그는 블록 아무 곳이나)
  app.querySelectorAll('[data-bid]').forEach((el) => {
    el.insertAdjacentHTML('beforeend',
      '<div class="eh-h eh-nw" data-dir="nw"></div><div class="eh-h eh-ne" data-dir="ne"></div>' +
      '<div class="eh-h eh-sw" data-dir="sw"></div><div class="eh-h eh-se" data-dir="se"></div>');
  });

  const dropLine = document.createElement('div');
  dropLine.id = 'drop-line';
  const bar = document.createElement('div');
  bar.id = 'home-edit-bar';
  bar.innerHTML = '<button type="button" class="btn-primary" id="eh-save">저장</button>' +
    '<a href="#/" class="btn-secondary">취소</a>';
  document.body.appendChild(bar);

  // 편집 중엔 블록 안 링크 클릭·이미지 기본 드래그 차단
  app.addEventListener('click', (e) => {
    if (document.body.classList.contains('home-editing') && e.target.closest('[data-bid] a')) e.preventDefault();
  }, true);
  app.addEventListener('dragstart', (e) => {
    if (document.body.classList.contains('home-editing')) e.preventDefault();
  });

  // 화면 배치 순서 → 블록의 anchor·순서로 역산
  const rebuildFromDom = () => {
    let anchor = 'top';
    const order = [];
    [...app.children].forEach((el) => {
      if (el.dataset.bid !== undefined) {
        const b = blockByBid[el.dataset.bid];
        if (b) { b.anchor = anchor; order.push(b); }
        return;
      }
      if (el.matches('.hero-full')) anchor = 'hero';
      else if (el.matches('.intro-split')) anchor = 'intro';
      else if (el.matches('.alt-row:not(.alt-reverse)')) anchor = 'f1';
      else if (el.matches('.alt-reverse')) anchor = 'f2';
      else if (el.matches('.interstitial')) anchor = 'banner';
      else if (el.matches('.pillar-strip')) anchor = 'end';
      else if (el.id === 'custom-pages-section' || el.matches('.post-section')) anchor = 'bottom';
    });
    lastHomeBlocks = order;
  };

  let dragEl = null;
  let lastY = 0;
  const insertionRef = (y) => {
    for (const k of [...app.children]) {
      if (k === dragEl || k.id === 'drop-line') continue;
      const r = k.getBoundingClientRect();
      if (y < r.top + r.height / 2) return k;
    }
    return null;
  };
  // 드래그 중 화면 가장자리 근처면 자동 스크롤 + 드롭 라인 갱신
  const dragTick = () => {
    if (!dragEl) return;
    if (lastY < 100) window.scrollBy({ top: -24, behavior: 'instant' });
    else if (lastY > innerHeight - 100) window.scrollBy({ top: 24, behavior: 'instant' });
    app.insertBefore(dropLine, insertionRef(lastY));
    requestAnimationFrame(dragTick);
  };
  const onDragMove = (e) => {
    e.preventDefault();
    lastY = e.clientY;
  };
  const onDragUp = () => {
    window.removeEventListener('pointermove', onDragMove);
    if (dropLine.parentElement) app.insertBefore(dragEl, dropLine);
    dropLine.remove();
    dragEl.classList.remove('eh-dragging');
    dragEl = null;
    rebuildFromDom();
  };

  // 4모서리 크기 조절: 어느 모서리든 바깥으로 끌면 커지고 안쪽으로 끌면 작아짐
  const onResizeDown = (e, el, dir) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('w-70', 'w-50', 'w-35', 'w-mid', 'w-narrow');
    el.classList.add('w-pct');
    const parentW = app.clientWidth;
    const startW = el.getBoundingClientRect().width;
    const startX = e.clientX;
    const sign = dir.includes('w') ? -1 : 1; // 왼쪽 모서리는 왼쪽으로 끌수록 커짐
    const move = (ev) => {
      const pct = Math.max(20, Math.min(100, ((startW + sign * (ev.clientX - startX)) / parentW) * 100));
      el.style.maxWidth = pct + '%';
      el.dataset.pct = Math.round(pct);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      const b = blockByBid[el.dataset.bid];
      if (b && el.dataset.pct) b.width = String(el.dataset.pct);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  app.addEventListener('pointerdown', (e) => {
    if (!document.body.classList.contains('home-editing')) return;
    const handle = e.target.closest('.eh-h');
    if (handle) {
      onResizeDown(e, handle.closest('[data-bid]'), handle.dataset.dir);
      return;
    }
    const block = e.target.closest('[data-bid]');
    if (!block || e.target.closest('a, button, input, select, textarea')) return;
    // 블록 아무 곳이나 잡고 드래그
    e.preventDefault();
    dragEl = block;
    lastY = e.clientY;
    dragEl.classList.add('eh-dragging');
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp, { once: true });
    requestAnimationFrame(dragTick);
  });

  $('#eh-save').addEventListener('click', async () => {
    const clean = lastHomeBlocks.map((b) => { const c = { ...b }; delete c.__bid; return c; });
    try {
      await db.setSetting('home_blocks', { blocks: clean });
      location.hash = '#/';
    } catch (e) { dbError(e); }
  });
}

/* ===== 사이트 전역 효과 (호버·패럴랙스·스무스·프로그레스) ===== */
function applySiteFx(conf) {
  document.documentElement.classList.toggle('fx-smooth', !!conf.smooth);
  document.body.classList.toggle('fx-hover', !!conf.hover);
  document.body.classList.toggle('fx-parallax', !!conf.parallax);
  document.body.classList.toggle('fx-progress', !!conf.progress);
  document.body.classList.toggle('fx-force', !!conf.force);
}

let fxTicking = false;
window.addEventListener('scroll', () => {
  if (fxTicking) return;
  fxTicking = true;
  requestAnimationFrame(() => {
    fxTicking = false;
    const body = document.body;
    if (body.classList.contains('fx-progress')) {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      $('#scroll-progress').style.width = (p * 100).toFixed(2) + '%';
    }
    if (body.classList.contains('fx-parallax') && !motionBlocked()) {
      document.querySelectorAll('.hero-full > img, .interstitial > img').forEach((img) => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) {
          img.style.transform = `translateY(${(r.top * -0.12).toFixed(1)}px) scale(1.15)`;
        }
      });
    }
  });
}, { passive: true });

/* ===== 라우터 ===== */
let navToken = 0;
function route() {
  navToken++;
  slideTimers.forEach(clearInterval);
  slideTimers = [];
  document.body.classList.remove('home-editing');
  $('#home-edit-bar')?.remove();
  $('#drop-line')?.remove();
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
  } else if (parts[0] === 'homebuild') {
    pageBuild(null, true);
  } else if (parts[0] === 'homeedit') {
    pageHomeEdit();
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

/* 부팅: 세션 복원 + 전역 효과 적용 후 첫 라우트 (효과 설정이 먼저 적용돼야 첫 화면부터 재생) */
showLoading();
// 푸터에 버전 표시 — 캐시된 옛 버전인지 바로 확인용
document.querySelector('.footer-copy')?.append(` · v${APP_VERSION}`);
Promise.all([
  sb.auth.getSession(),
  db.getSetting('site_fx').catch(() => ({})),
]).then(([{ data }, siteFx]) => {
  adminOn = !!data.session;
  applySiteFx(siteFx);
  route();
});

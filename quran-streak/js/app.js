import * as L from './logic.js';
import { t, setLang, lang, badgeName } from './i18n.js';
import { storage, cleanDays, COLORS, LocalStore, SharedStore, DemoStore } from './store.js';
import { Sky } from './sky.js';
import * as fx from './fx.js';
import { REMINDERS, REWARD } from './reminders.js';

const CONFIG = window.NOOR_FIREBASE || null;
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const settings = {
  lang: (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en',
  sound: true,
  ...storage.get('noor.settings', {}),
};
setLang(settings.lang);

const app = $('#app');
const sheet = $('#sheet');
const state = {
  screen: null, // 'welcome' | 'join' | 'main'
  store: null,
  session: null,
  members: [],
  meId: null,
  today: L.appDay(),
  calMonth: L.monthOf(L.appDay()), // the month the calendar shows, 'YYYY-MM'
  serverSeen: false,
  syncError: false,
};
let sky = null;

// ---------- drawing helpers ----------

/** A star with `points` points: outer radius R, inner radius r. Two of these squares make the ۞ of the mushaf. */
function starPath(R, r, points = 8) {
  const out = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const radius = i % 2 ? r : R;
    out.push(`${(Math.cos(a) * radius).toFixed(2)},${(Math.sin(a) * radius).toFixed(2)}`);
  }
  return `M${out.join('L')}Z`;
}

const RUB = starPath(48, 36.74);
const RUB_INNER = starPath(30, 22.96);

const ICON = {
  sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  rings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>',
  back: '<svg viewBox="0 0 24 24" class="flip-rtl" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  forward: '<svg viewBox="0 0 24 24" class="flip-rtl" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
};

function emblem(days, earned) {
  const points = { 3: 5, 7: 6, 14: 7, 30: 8, 40: 10, 60: 12, 100: 14, 200: 16, 365: 20 }[days];
  const ratio = points >= 12 ? 0.84 : points >= 8 ? 0.76 : 0.62;
  return `<svg viewBox="-50 -50 100 100" class="emblem${earned ? ' on' : ''}" aria-hidden="true">
    <path class="e-star" d="${starPath(47, 47 * ratio, points)}"/>
    <circle class="e-ring" r="27"/>
    <text class="e-num" y="1" text-anchor="middle" dominant-baseline="middle">${days}</text>
  </svg>`;
}

function quote(item, cls = '') {
  const text = item.verse ? `﴿${item.ar}﴾` : `«${item.ar}»`;
  return `<blockquote class="quote ${item.verse ? 'verse' : 'hadith'} ${cls}">
    <p class="q-ar" lang="ar" dir="rtl">${text}</p>
    ${lang() === 'en' ? `<p class="q-en">${esc(item.en)}</p>` : ''}
    <cite>${esc(item.src[lang()])}</cite>
  </blockquote>`;
}

function langSwitch() {
  return `<div class="seg" role="group" aria-label="${esc(t('language'))}">
    <button type="button" data-act="lang" data-lang="en" aria-pressed="${lang() === 'en'}">English</button>
    <button type="button" data-act="lang" data-lang="ar" aria-pressed="${lang() === 'ar'}" lang="ar">العربية</button>
  </div>`;
}

function logo() {
  return `<div class="logo">
    <svg viewBox="-60 -60 120 120" class="logo-rub" aria-hidden="true"><path d="${RUB}"/><path class="inner" d="${RUB_INNER}"/></svg>
    <h1><span class="brand-ar" lang="ar">نور</span><span class="brand-en">Noor</span></h1>
    <p class="tagline">${esc(t('tagline'))}</p>
  </div>`;
}

// ---------- data ----------

function me() {
  return state.members.find((m) => m.id === state.meId) || null;
}

function cleanMember(raw) {
  return {
    id: String(raw.id),
    name: String(raw.name || '…').slice(0, 24),
    color: /^#[0-9a-f]{6}$/i.test(raw.color || '') ? raw.color : COLORS[0],
    days: cleanDays(raw.days),
    order: raw.joinedAt?.seconds ?? raw.order ?? 0,
  };
}

function sortMembers(list) {
  return list.sort((a, b) => (a.id === state.meId ? -1 : b.id === state.meId ? 1 : a.order - b.order));
}

function statsOf(member) {
  return L.streaks(L.readDays(member.days, state.today), state.today);
}

function togetherStats() {
  return L.streaks(L.sharedDays(state.members.map((m) => L.readDays(m.days, state.today))), state.today);
}

function baseUrl() {
  return location.origin + location.pathname;
}

const inviteLink = () => `${baseUrl()}#join=${state.session.circleId}`;
const personalLink = () => `${baseUrl()}#join=${state.session.circleId}&me=${state.session.memberId}`;

function onMembers(list, meta = {}) {
  const before = new Map(state.members.map((m) => [m.id, m.days[state.today] !== undefined]));
  state.members = sortMembers(list.map(cleanMember));
  if (state.store?.mode === 'shared') storage.set('noor.cache', { circleId: state.session.circleId, members: state.members });
  if (meta.fromServer) {
    state.syncError = false;
    if (state.store?.mode === 'shared' && !state.members.some((m) => m.id === state.meId)) {
      storage.del('noor.session');
      storage.del('noor.cache');
      showJoin(state.session.circleId);
      return;
    }
    if (state.serverSeen) {
      for (const m of state.members) {
        if (m.id !== state.meId && !before.get(m.id) && m.days[state.today] !== undefined) {
          toast(t('friendRead', { name: m.name }));
          if (settings.sound) fx.chime('soft');
        }
      }
    }
    state.serverSeen = true;
  }
  render();
}

function onSyncError(err) {
  console.warn('Noor sync:', err);
  state.syncError = true;
  renderBanner();
}

function setMyDay(day, pages, { flash = false } = {}) {
  const m = me();
  if (!m) return;
  m.days = { ...m.days, [day]: pages };
  render(flash ? m.id : null);
  state.store.setDay(day, pages).catch(onSyncError);
}

function clearMyDay(day) {
  const m = me();
  if (!m) return;
  const days = { ...m.days };
  delete days[day];
  m.days = days;
  render();
  state.store.clearDay(day).catch(onSyncError);
}

// ---------- screens ----------

function startDemo() {
  const store = new DemoStore(L.appDay(), { me: t('demoMe'), friend: t('demoFriend') });
  state.store = store;
  state.session = null;
  state.meId = store.meId();
  state.members = [];
  showMain();
  store.subscribe(onMembers);
}

function startLocal(store) {
  state.store = store;
  state.session = null;
  state.meId = store.meId();
  state.members = [];
  showMain();
  store.subscribe(onMembers);
}

function startShared(session, store = new SharedStore(CONFIG)) {
  store.use(session);
  state.store = store;
  state.session = session;
  state.meId = session.memberId;
  state.serverSeen = false;
  storage.set('noor.session', session);
  const cache = storage.get('noor.cache', null);
  state.members = cache?.circleId === session.circleId ? sortMembers(cache.members.map(cleanMember)) : [];
  showMain();
  store.subscribe(onMembers, onSyncError).catch(onSyncError);
}

function showWelcome(note = '') {
  state.screen = 'welcome';
  const local = new LocalStore();
  app.innerHTML = `<div class="welcome">
    <div class="welcome-top">${langSwitch()}</div>
    ${logo()}
    <p class="intro">${esc(t('intro'))}</p>
    ${note ? `<p class="note">${esc(note)}</p>` : ''}
    <form class="name-form" id="welcome-form" novalidate>
      <label for="name">${esc(t('yourName'))}</label>
      <input id="name" maxlength="24" autocomplete="given-name" enterkeyhint="go" value="${esc(local.profile?.me.name || '')}">
      <button class="btn primary wide" type="submit">${esc(t('start'))}</button>
      ${CONFIG ? `<button class="link" type="button" data-act="solo">${esc(t('startSolo'))}</button>` : ''}
    </form>
  </div>`;
  $('#welcome-form').addEventListener('submit', (e) => {
    e.preventDefault();
    begin(Boolean(CONFIG));
  });
}

async function begin(shared) {
  const input = $('#name');
  const name = input.value.trim().slice(0, 24);
  if (!name) {
    input.focus();
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);
    return;
  }
  const local = new LocalStore();
  if (shared) {
    busy(true);
    try {
      const store = new SharedStore(CONFIG);
      const session = await store.createCircle(name, local.profile?.days);
      local.forget();
      startShared(session, store);
      openInvite();
      return;
    } catch (err) {
      console.warn(err);
      toast(t('offlineCreate'));
    } finally {
      busy(false);
    }
  }
  if (!local.profile) local.create(name);
  else if (local.profile.me.name !== name) local.rename(name);
  startLocal(local);
}

function busy(on) {
  for (const b of app.querySelectorAll('button')) b.disabled = on;
  app.classList.toggle('is-busy', on);
}

async function showJoin(circleId, memberHint = null) {
  state.screen = 'join';
  app.innerHTML = `<div class="welcome">${logo()}<p class="intro">${esc(t('loading'))}</p></div>`;
  const store = new SharedStore(CONFIG);
  let circle = null;
  let members = [];
  try {
    [circle, members] = await Promise.all([store.getCircle(circleId), store.getMembers(circleId)]);
  } catch (err) {
    console.warn(err);
  }
  if (state.screen !== 'join') return;
  if (!circle) {
    app.innerHTML = `<div class="welcome">${logo()}<p class="note">${esc(t('badLink'))}</p>
      <button class="btn primary wide" data-act="start-own">${esc(t('startOwn'))}</button></div>`;
    return;
  }
  const known = memberHint && members.find((m) => m.id === memberHint);
  if (known) {
    startShared({ circleId, memberId: known.id }, store);
    toast(t('welcomeBack', { name: known.name }));
    return;
  }
  const local = new LocalStore();
  app.innerHTML = `<div class="welcome">
    <div class="welcome-top">${langSwitch()}</div>
    ${logo()}
    <p class="intro invited">${esc(t('invitedBy', { name: circle.by }))}</p>
    <form class="name-form" id="join-form" novalidate>
      <label for="name">${esc(t('yourName'))}</label>
      <input id="name" maxlength="24" autocomplete="given-name" enterkeyhint="go" value="${esc(local.profile?.me.name || '')}">
      <button class="btn primary wide" type="submit">${esc(t('join'))}</button>
    </form>
    ${members.length ? `<div class="claim"><p>${esc(t('alreadyIn'))}</p><div class="claim-list">${members
      .map((m) => `<button class="btn ghost" data-act="claim" data-id="${esc(m.id)}" data-name="${esc(m.name)}" style="--c:${cleanMember(m).color}">${esc(t('iAm', { name: m.name }))}</button>`)
      .join('')}</div></div>` : ''}
  </div>`;
  app.dataset.circle = circleId;
  $('#join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#name');
    const name = input.value.trim().slice(0, 24);
    if (!name) {
      input.focus();
      return;
    }
    busy(true);
    try {
      const session = await store.joinCircle(circleId, name, local.profile?.days, members.map((m) => m.color));
      local.forget();
      startShared(session, store);
      toast(t('welcomeBack', { name }));
    } catch (err) {
      console.warn(err);
      toast(t('syncError'));
      busy(false);
    }
  });
  app.joinStore = store;
}

function showMain() {
  state.screen = 'main';
  app.innerHTML = `<div class="main">
    <header class="top">
      <div class="brand"><svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="${RUB}"/></svg><span class="brand-ar" lang="ar">نور</span><span class="brand-en">Noor</span></div>
      <button class="icon-btn" data-act="settings" aria-label="${esc(t('settingsLabel'))}">${ICON.sliders}</button>
    </header>
    <p class="banner" id="banner" hidden></p>
    ${state.store?.mode === 'demo' ? `<p class="demo-note">${esc(t('demoNote'))} <a class="link" href="${esc(window.NOOR_SITE || './')}"${window.NOOR_SITE ? ' target="_blank" rel="noopener"' : ''}>${esc(t('demoExit'))}</a></p>` : ''}
    <section class="hero">
      <p class="kicker" id="kicker"></p>
      <button class="rub-btn" id="checkin" data-act="checkin" aria-label="${esc(t('editToday'))}">
        <svg viewBox="-62 -62 124 124" aria-hidden="true">
          <circle class="ring-track" r="58"/>
          <circle class="ring-fill" id="ring" r="58" pathLength="100" stroke-dasharray="0 100"/>
          <g class="rub-rot">
            <path class="rub-star" d="${RUB}"/>
            <path class="rub-inner" d="${RUB_INNER}"/>
          </g>
          <circle class="rub-core" r="18"/>
          <path class="rub-check" d="M-8.5,0.5 L-2.5,7 L9,-6.5" pathLength="1"/>
        </svg>
      </button>
      <div class="streak"><span class="streak-num" id="streak-num">0</span><span class="streak-unit" id="streak-unit"></span></div>
      <div class="ask" id="ask" hidden>
        <p class="ask-q">${esc(t('askToday'))}</p>
        <div class="ask-btns">
          <button class="btn primary" data-act="yes">${esc(t('yesWallahi'))}</button>
          <button class="btn ghost" data-act="no">${esc(t('no'))}</button>
        </div>
      </div>
      <p class="hero-sub" id="hero-sub">${esc(t('loading'))}</p>
      <p class="yesterday" id="yesterday" hidden><span>${esc(t('markYesterday'))}</span>
        <button class="link" data-act="yesterday">${esc(t('markYesterdayBtn'))}</button></p>
    </section>
    <section id="people"></section>
    <section class="card sky-card">
      <div class="card-head"><h2 id="sky-title"></h2><span class="count" id="sky-count"></span></div>
      <canvas id="sky" role="img" aria-label="${esc(t('skyLine'))}"></canvas>
      <p class="sky-line">${esc(t('skyLine'))}</p>
      <div class="legend" id="legend"></div>
    </section>
    <section class="card cal-card" id="calendar">
      <div class="cal-head">
        <div class="cal-title"><h2>${esc(t('calendarTitle'))}</h2><p class="cal-hijri" id="cal-hijri"></p></div>
        <div class="cal-nav">
          <button class="icon-btn small" data-act="cal-prev" aria-label="${esc(t('prevMonth'))}">${ICON.back}</button>
          <span class="cal-month" id="cal-month"></span>
          <button class="icon-btn small" data-act="cal-next" aria-label="${esc(t('nextMonth'))}">${ICON.forward}</button>
        </div>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
      <p class="cal-hint">${esc(t('calendarHint'))}</p>
    </section>
    <section class="pair">
      <article class="card stats" id="stats"></article>
      <article class="card khatma" id="khatma"></article>
    </section>
    <section class="card">
      <div class="card-head"><h2>${esc(t('badges'))}</h2></div>
      <div class="badges" id="badges"></div>
    </section>
    <section class="reminder" id="reminder"></section>
    <footer class="foot">${esc(t('dayNote'))}</footer>
  </div>`;
  sky = new Sky($('#sky'));
  render();
}

// ---------- rendering the main screen ----------

function render(flashId = null) {
  if (state.screen !== 'main') return;
  state.today = L.appDay();
  const m = me();
  renderBanner();
  if (!m) return;
  renderHero(m);
  renderPeople();
  renderSky(flashId);
  renderCalendar(m);
  renderStats(m);
  renderKhatma(m);
  renderBadges(m);
  renderReminder();
}

function renderBanner() {
  const el = $('#banner');
  if (!el) return;
  const problem = state.store?.mode === 'shared' && (state.syncError || !navigator.onLine);
  el.hidden = !problem;
  el.textContent = problem ? t('syncError') : '';
}

function msLeft() {
  return Math.max(0, L.dayEndsAt(state.today) - Date.now());
}

function timeLeft() {
  const mins = Math.floor(msLeft() / 60000);
  return t('time', { h: Math.floor(mins / 60), m: mins % 60 });
}

function renderHero(m) {
  const s = statsOf(m);
  // Until today is answered, the star is only a picture: the answer is the question under it.
  const btn = $('#checkin');
  btn.classList.toggle('is-done', s.readToday);
  btn.classList.toggle('is-idle', !s.readToday);
  btn.tabIndex = s.readToday ? 0 : -1;
  btn.setAttribute('aria-hidden', String(!s.readToday));
  $('#ask').hidden = s.readToday;
  // The ring fills towards the next milestone, and shows full on the day a milestone is reached.
  const progress = s.readToday && L.MILESTONES.includes(s.current) ? 1 : L.milestoneProgress(s.current);
  const ring = $('#ring');
  ring.setAttribute('stroke-dasharray', `${(progress * 100).toFixed(1)} 100`);
  ring.style.opacity = progress > 0 ? '1' : '0';
  $('#streak-num').textContent = s.current;
  $('#streak-unit').textContent = t('daysInRow', { n: s.current });
  $('#kicker').textContent = s.readToday ? t('accepted') : s.current > 0 ? t('keep', { n: s.current }) : t('startToday');
  const pages = m.days[state.today];
  const sub = $('#hero-sub');
  if (s.readToday) sub.textContent = pages > 0 ? t('pagesToday', { n: pages }) : t('readToday');
  else sub.textContent = t('endsIn', { time: timeLeft() });
  sub.classList.toggle('urgent', !s.readToday && s.current > 0 && msLeft() < 4 * 3600e3);
  const yesterday = L.addDays(state.today, -1);
  $('#yesterday').hidden = m.days[yesterday] !== undefined || m.days[L.addDays(state.today, -2)] === undefined;
}

function renderPeople() {
  const box = $('#people');
  const shared = state.store.mode === 'shared';
  const many = state.members.length > 1;
  let html = '';
  if (many) {
    const iRead = me()?.days[state.today] !== undefined;
    html += `<div class="people">${state.members.map((m) => personCard(m, iRead)).join('')}</div>`;
    const tog = togetherStats();
    html += `<div class="card together${tog.readToday ? ' lit' : ''}">
      <span class="t-icon">${ICON.rings}</span>
      <div><p class="t-title">${esc(t('togetherTitle'))}</p>
      ${tog.current > 0 ? `<p class="t-line"><b>${tog.current}</b> ${esc(t(state.members.length === 2 ? 'togetherLabel2' : 'togetherLabel'))}</p>` : `<p class="t-line">${esc(t('togetherZero'))}</p>`}</div>
    </div>`;
  } else if (shared) {
    html += `<div class="card cta"><div><p class="cta-title">${esc(t('invite'))}</p><p class="muted">${esc(t('inviteLine'))}</p></div>
      <button class="btn primary" data-act="invite">${ICON.share}<span>${esc(t('invite'))}</span></button></div>`;
  } else if (CONFIG) {
    html += `<div class="card cta"><div><p class="cta-title">${esc(t('startShared'))}</p><p class="muted">${esc(t('startSharedLine'))}</p></div>
      <button class="btn primary" data-act="start-shared">${esc(t('startShared'))}</button></div>`;
  } else {
    // Sharing needs the site's Firebase settings; until then, say where the button will be.
    html += `<div class="card cta"><div><p class="cta-title">${esc(t('startShared'))}</p><p class="muted">${esc(t('sharingOff'))}</p></div></div>`;
  }
  box.innerHTML = html;
}

function personCard(m, iRead) {
  const s = statsOf(m);
  const isMe = m.id === state.meId;
  const week = L.lastDays(state.today, 7)
    .map((d) => `<i class="${m.days[d] !== undefined ? 'on' : ''}${d === state.today ? ' now' : ''}"></i>`)
    .join('');
  const remind = !isMe && !s.readToday && iRead
    ? `<button class="btn tiny ghost" data-act="nudge" data-id="${esc(m.id)}">${ICON.bell}<span>${esc(t('remind'))}</span></button>`
    : '';
  return `<article class="person${s.readToday ? ' lit' : ''}" style="--c:${m.color}">
    <header><svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="${RUB}"/></svg><b>${esc(m.name)}</b>${isMe && state.store.mode !== 'demo' ? `<span class="you">${esc(t('you'))}</span>` : ''}</header>
    <p class="p-num">${s.current}<small>${esc(t('daysInRow', { n: s.current }))}</small></p>
    <p class="p-status">${esc(s.readToday ? t('readTodayShort') : t('notYet'))}</p>
    <div class="week" aria-hidden="true">${week}</div>
    ${remind}
  </article>`;
}

function renderSky(flashId) {
  const single = state.members.length === 1;
  $('#sky-title').textContent = single ? t('skyMine') : t('skyOurs');
  const total = state.members.reduce((n, m) => n + L.readDays(m.days, state.today).length, 0);
  $('#sky-count').textContent = t('stars', { n: total });
  $('#legend').innerHTML = single
    ? ''
    : state.members.map((m) => `<span><i style="background:${m.color}"></i>${esc(m.name)}</span>`).join('');
  sky.update({ members: state.members, today: state.today, flashId });
}

function renderStats(m) {
  const s = statsOf(m);
  $('#stats').innerHTML = `<h2>${esc(t('statsTitle'))}</h2>
    <div class="stat"><b>${s.total}</b><span>${esc(t('daysRead'))}</span></div>
    <div class="stat"><b>${s.best}</b><span>${esc(t('bestStreak'))}</span></div>`;
}

function renderKhatma(m) {
  const k = L.khatma(m.days);
  const el = $('#khatma');
  if (!k.total) {
    el.innerHTML = `<h2>${esc(t('khatma'))}</h2><p class="muted small">${esc(t('khatmaHint'))}</p>`;
    return;
  }
  const pct = (k.pages / L.MUSHAF_PAGES) * 100;
  el.innerHTML = `<h2>${esc(t('khatma'))}</h2>
    <div class="k-ring">
      <svg viewBox="-50 -50 100 100" aria-hidden="true"><circle class="k-track" r="42"/><circle class="k-fill" r="42" pathLength="100" stroke-dasharray="${pct.toFixed(1)} 100"/></svg>
      <span><b>${Math.round(pct)}%</b></span>
    </div>
    <p class="small">${esc(t('khatmaLine', { p: k.pages }))}</p>
    ${k.done ? `<p class="small gold">${esc(t('khatmaDone', { n: k.done }))}</p>` : ''}`;
}

function renderBadges(m) {
  const s = statsOf(m);
  const next = L.MILESTONES.find((d) => s.best < d);
  $('#badges').innerHTML = L.MILESTONES.map((d) => {
    const earned = s.best >= d;
    const sub = earned ? t('earned') : d === next ? t('toGo', { n: d - s.current }) : '';
    return `<div class="badge${earned ? ' on' : ''}${d === next ? ' next' : ''}">${emblem(d, earned)}
      <b>${esc(badgeName(d))}</b><small>${esc(sub)}</small></div>`;
  }).join('');
}

function renderReminder() {
  $('#reminder').innerHTML = quote(L.dailyPick(REMINDERS, state.today));
}

// ---------- check-in and the reward ----------

function checkIn() {
  const m = me();
  if (!m) return;
  if (m.days[state.today] !== undefined) {
    openToday();
    return;
  }
  const before = statsOf(m);
  setMyDay(state.today, 0, { flash: true });
  const after = statsOf(me());
  celebrate(after.current);
  openCelebration(before, after);
}

function celebrate(current) {
  const btn = $('#checkin');
  const rect = btn.getBoundingClientRect();
  const milestone = L.MILESTONES.includes(current);
  fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: milestone ? 160 : 100, power: milestone ? 1.35 : 1 });
  if (settings.sound) {
    fx.chime(milestone ? 'milestone' : 'check');
    fx.buzz(milestone ? [20, 50, 20, 50, 60] : [18, 40, 28]);
  }
}

function openCelebration(before, after) {
  const milestone = L.MILESTONES.includes(after.current) ? after.current : null;
  const isNew = milestone && before.best < milestone;
  const friends = state.members.filter((x) => x.id !== state.meId && x.days[state.today] !== undefined);
  openSheet(`<div class="celebrate">
    ${milestone ? `<div class="c-badge">${emblem(milestone, true)}</div>
      <p class="c-milestone">${esc(t(isNew ? 'newBadge' : 'againBadge', { name: badgeName(milestone) }))}</p>` : ''}
    <p class="c-kicker">${esc(t('accepted'))}</p>
    <p class="c-num"><span id="c-num">${before.current}</span></p>
    <p class="c-unit">${esc(t('daysInRow', { n: after.current }))}</p>
    ${friends.map((f) => `<p class="c-friend" style="--c:${f.color}">${esc(t('alsoRead', { name: f.name }))}</p>`).join('')}
    ${quote(REWARD, 'reward')}
    ${pagesPicker(0)}
    <button class="btn primary wide" data-act="close">${esc(t('done'))}</button>
  </div>`, 'is-celebrate');
  countUp($('#c-num'), before.current, after.current);
}

function countUp(el, from, to) {
  if (!el || to <= from) return;
  const steps = Math.min(to - from, 24);
  let i = 0;
  const tick = () => {
    i++;
    el.textContent = Math.round(from + ((to - from) * i) / steps);
    el.classList.remove('flip');
    void el.offsetWidth;
    el.classList.add('flip');
    if (i < steps) setTimeout(tick, 70);
  };
  setTimeout(tick, 420);
}

function pagesPicker(selected, day = state.today) {
  const options = [1, 2, 5, 10, 20];
  const custom = selected > 0 && !options.includes(selected) ? selected : '';
  return `<div class="pages" data-day="${day}">
    <p class="pages-q">${esc(t(day === state.today ? 'howMuch' : 'howMuchThen'))} <span>(${esc(t('optional'))})</span></p>
    <div class="chips" role="group" aria-label="${esc(t('pagesUnit'))}">
      ${options.map((p) => `<button type="button" class="chip${selected === p ? ' on' : ''}" data-pages="${p}" aria-pressed="${selected === p}">${p === 20 ? esc(t('juz')) : p}</button>`).join('')}
      <input class="chip-input${custom ? ' on' : ''}" id="pages-other" type="number" inputmode="numeric" min="1" max="604" placeholder="${esc(t('other'))}" value="${custom}" aria-label="${esc(t('other'))}">
    </div>
    <p class="pages-unit">${esc(t('pagesUnit'))}</p>
  </div>`;
}

function choosePages(pages, day) {
  const m = me();
  if (!m || m.days[day] === undefined) return;
  const current = m.days[day];
  const next = current === pages ? 0 : pages;
  const before = L.khatma(m.days);
  setMyDay(day, next);
  const after = L.khatma(me().days);
  for (const chip of sheet.querySelectorAll('.chip')) {
    const on = Number(chip.dataset.pages) === next;
    chip.classList.toggle('on', on);
    chip.setAttribute('aria-pressed', String(on));
  }
  const other = $('#pages-other', sheet);
  if (other && Number(other.value) !== next) {
    other.value = '';
    other.classList.remove('on');
  }
  if (after.done > before.done) {
    fx.burst(innerWidth / 2, innerHeight / 2, { count: 180, power: 1.5 });
    if (settings.sound) fx.chime('milestone');
    toast(t('khatmaComplete'));
  }
}

function openToday() {
  const m = me();
  openSheet(`<div class="today-sheet">
    <p class="c-kicker">${esc(t('accepted'))}</p>
    <h2>${esc(t('todayTitle'))}</h2>
    ${pagesPicker(m.days[state.today] || 0)}
    <button class="btn primary wide" data-act="close">${esc(t('done'))}</button>
    <button class="link danger" data-act="undo">${esc(t('undo'))}</button>
  </div>`);
}

// ---------- past days: the calendar and the question ----------

const CONSISTENCY = REMINDERS.find((r) => r.src.en === 'Al-Bukhari and Muslim');

function dateLocale() {
  return lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
}

function utcDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function longDate(day) {
  return new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utcDate(day));
}

function askText(day) {
  if (day === state.today) return t('askToday');
  if (day === L.addDays(state.today, -1)) return t('askYesterday');
  return t('askDay', { date: longDate(day) });
}

function readText(day) {
  if (day === L.addDays(state.today, -1)) return t('readYesterday');
  return t('readOn', { date: longDate(day) });
}

/** The first day of the week where the phone is set up: Saturday in Egypt, Sunday or Monday elsewhere. */
function weekStart() {
  try {
    const locale = new Intl.Locale(navigator.language || 'en');
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch {}
  return lang() === 'ar' ? 6 : 0;
}

/** The Hijri months a Gregorian month spans, for example "Jumada I – Jumada II 1448 AH". */
function hijriRange(first, last) {
  try {
    const f = new Intl.DateTimeFormat(`${lang() === 'ar' ? 'ar-EG' : 'en'}-u-ca-islamic-umalqura-nu-latn`, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    if (f.format(first) === f.format(last)) return f.format(first);
    return f.formatRange ? f.formatRange(first, last) : `${f.format(first)} – ${f.format(last)}`;
  } catch {
    return '';
  }
}

function renderCalendar(m) {
  const month = state.calMonth;
  const thisMonth = L.monthOf(state.today);
  const first = utcDate(`${month}-01`);
  const length = L.daysInMonth(month);
  $('#cal-month').textContent = new Intl.DateTimeFormat(dateLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  $('#cal-hijri').textContent = hijriRange(first, utcDate(`${month}-${String(length).padStart(2, '0')}`));
  $('[data-act="cal-next"]').disabled = month >= thisMonth;
  $('[data-act="cal-prev"]').disabled = month <= L.addMonths(thisMonth, -24);
  const start = weekStart();
  const weekday = new Intl.DateTimeFormat(dateLocale(), { weekday: lang() === 'ar' ? 'narrow' : 'short', timeZone: 'UTC' });
  const heads = Array.from({ length: 7 }, (_, i) => `<span class="cal-wd">${esc(weekday.format(new Date(Date.UTC(2024, 0, 7 + ((start + i) % 7)))))}</span>`);
  const lead = (L.weekday(`${month}-01`) - start + 7) % 7;
  const cells = Array.from({ length: lead }, () => '<span></span>');
  for (let d = 1; d <= length; d++) {
    const day = `${month}-${String(d).padStart(2, '0')}`;
    const read = m.days[day] !== undefined;
    const label = read ? `${longDate(day)}, ${t('readMark')}` : longDate(day);
    cells.push(`<button type="button" class="cal-day${read ? ' on' : ''}${day === state.today ? ' today' : ''}" data-act="day" data-day="${day}"${day > state.today ? ' disabled' : ''} aria-label="${esc(label)}">${d}</button>`);
  }
  $('#cal-grid').innerHTML = heads.join('') + cells.join('');
}

function openDay(day) {
  const m = me();
  if (!m || !L.isDay(day) || day > state.today) return;
  if (m.days[day] === undefined) openAsk(day);
  else if (day === state.today) openToday();
  else openDayRead(day);
}

function openAsk(day) {
  openSheet(`<div class="ask-sheet">
    <svg viewBox="-60 -60 120 120" class="logo-rub small" aria-hidden="true"><path d="${RUB}"/><path class="inner" d="${RUB_INNER}"/></svg>
    <h2>${esc(askText(day))}</h2>
    <div class="ask-btns">
      <button type="button" class="btn primary" data-act="ask-yes" data-day="${day}">${esc(t('yesWallahi'))}</button>
      <button type="button" class="btn ghost" data-act="ask-no" data-day="${day}">${esc(t('no'))}</button>
    </div>
  </div>`);
}

function openNotYet() {
  const s = statsOf(me());
  openSheet(`<div class="notyet">
    <svg viewBox="-60 -60 120 120" class="logo-rub small" aria-hidden="true"><path d="${RUB}"/><path class="inner" d="${RUB_INNER}"/></svg>
    <h2>${esc(t('notYetTitle'))}</h2>
    <p>${esc(t('notYetLine'))}</p>
    ${s.current > 0 ? `<p class="gold">${esc(t('notYetStreak', { n: s.current }))}</p>` : ''}
    ${CONSISTENCY ? quote(CONSISTENCY, 'reward') : ''}
    <p class="muted small">${esc(t('endsIn', { time: timeLeft() }))}</p>
    <button type="button" class="btn primary wide" data-act="close">${esc(t('willRead'))}</button>
  </div>`);
}

/** A past day answered with Yes: save it, show what it did to the streak, and ask for the pages. */
function markPastDay(day, from) {
  const m = me();
  if (!m || day >= state.today) return;
  const before = statsOf(m);
  setMyDay(day, 0);
  const after = statsOf(me());
  const badge = L.MILESTONES.filter((d) => before.best < d && after.best >= d).pop();
  const rect = from.getBoundingClientRect();
  fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: badge ? 140 : 70, power: badge ? 1.2 : 0.85 });
  if (settings.sound) {
    fx.chime(badge ? 'milestone' : 'soft');
    fx.buzz([16, 30, 20]);
  }
  openSheet(`<div class="ask-sheet">
    ${badge ? `<div class="c-badge">${emblem(badge, true)}</div><p class="c-milestone">${esc(t('newBadge', { name: badgeName(badge) }))}</p>` : ''}
    <p class="c-kicker">${esc(t('accepted'))}</p>
    <h2>${esc(t('daySaved'))}</h2>
    ${after.current !== before.current ? `<p class="muted">${esc(t('streakNow', { n: after.current }))}</p>` : ''}
    ${pagesPicker(0, day)}
    <button type="button" class="btn primary wide" data-act="close">${esc(t('done'))}</button>
  </div>`);
}

function openDayRead(day) {
  const m = me();
  openSheet(`<div class="today-sheet">
    <p class="c-kicker">${esc(t('accepted'))}</p>
    <h2>${esc(readText(day))}</h2>
    ${pagesPicker(m.days[day] || 0, day)}
    <button type="button" class="btn primary wide" data-act="close">${esc(t('done'))}</button>
    <button type="button" class="link danger" data-act="remove-day" data-day="${day}">${esc(t('removeDay'))}</button>
  </div>`);
}

// ---------- sheets ----------

function openSheet(html, cls = '') {
  sheet.innerHTML = `<div class="sheet-backdrop" data-act="close"></div>
    <div class="sheet-panel ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  sheet.hidden = false;
  document.body.classList.add('locked');
  requestAnimationFrame(() => sheet.classList.add('open'));
}

function closeSheet() {
  sheet.classList.remove('open');
  document.body.classList.remove('locked');
  setTimeout(() => {
    if (!sheet.classList.contains('open')) {
      sheet.hidden = true;
      sheet.innerHTML = '';
    }
  }, 260);
}

function linkBox(url, id) {
  return `<div class="linkbox"><input readonly id="lb-${id}" value="${esc(url)}" aria-label="${esc(t('copy'))}">
    <button type="button" class="btn ghost" data-act="copy" data-target="lb-${id}">${esc(t('copy'))}</button></div>`;
}

function openInvite() {
  openSheet(`<div class="invite">
    <svg viewBox="-60 -60 120 120" class="logo-rub small" aria-hidden="true"><path d="${RUB}"/><path class="inner" d="${RUB_INNER}"/></svg>
    <h2>${esc(t('invite'))}</h2>
    <p class="muted">${esc(t('inviteLine'))}</p>
    ${linkBox(inviteLink(), 'invite')}
    <button type="button" class="btn primary wide" data-act="share-invite">${ICON.share}<span>${esc(t('share'))}</span></button>
    <button type="button" class="link" data-act="close">${esc(t('close'))}</button>
  </div>`);
}

function openSettings() {
  const m = me();
  const shared = state.store?.mode === 'shared';
  openSheet(`<div class="settings">
    <h2>${esc(t('settings'))}</h2>
    <form class="field" id="name-form">
      <label for="set-name">${esc(t('name'))}</label>
      <div class="row"><input id="set-name" maxlength="24" value="${esc(m?.name)}" autocomplete="given-name">
      <button class="btn ghost" type="submit">${esc(t('save'))}</button></div>
    </form>
    <div class="field"><span class="label">${esc(t('language'))}</span>${langSwitch()}</div>
    <div class="field"><span class="label">${esc(t('sound'))}</span>
      <div class="seg" role="group" aria-label="${esc(t('sound'))}">
        <button type="button" data-act="sound" data-on="1" aria-pressed="${settings.sound}">${esc(t('on'))}</button>
        <button type="button" data-act="sound" data-on="0" aria-pressed="${!settings.sound}">${esc(t('off'))}</button>
      </div></div>
    ${shared ? `<div class="field"><span class="label">${esc(t('invite'))}</span>
        <button type="button" class="btn ghost wide" data-act="invite">${ICON.share}<span>${esc(t('invite'))}</span></button></div>
      <div class="field"><span class="label">${esc(t('anotherPhone'))}</span>
        <p class="muted small">${esc(t('anotherPhoneLine'))}</p>${linkBox(personalLink(), 'personal')}</div>` : ''}
    ${!shared && CONFIG ? `<div class="field"><span class="label">${esc(t('startShared'))}</span>
        <p class="muted small">${esc(t('startSharedLine'))}</p>
        <button type="button" class="btn primary wide" data-act="start-shared">${esc(t('startShared'))}</button></div>` : ''}
    ${installed() ? '' : `<div class="field"><span class="label">${esc(t('install'))}</span>
        <p class="muted small">${esc(installPrompt ? t('installLine') : t('installHow'))}</p>
        ${installPrompt ? `<button type="button" class="btn ghost wide" data-act="install">${esc(t('installBtn'))}</button>` : ''}</div>`}
    <p class="muted small">${esc(t('dayNote'))}</p>
    <button type="button" class="btn primary wide" data-act="close">${esc(t('done'))}</button>
    <button type="button" class="link danger" data-act="reset">${esc(t('reset'))}</button>
  </div>`);
  $('#name-form', sheet).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#set-name', sheet).value.trim().slice(0, 24);
    if (!name || !me()) return;
    me().name = name;
    render();
    state.store.rename(name).catch(onSyncError);
    toast(t('saved'));
  });
}

// Android browsers offer their own install prompt; keep it for the button in Settings.
let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});

function installed() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

async function install() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  closeSheet();
}

async function shareText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function nudge(id) {
  const friend = state.members.find((m) => m.id === id);
  if (!friend) return;
  shareText(t('nudgeText', { name: friend.name, n: togetherStats().current, url: baseUrl() }));
}

async function copyFrom(id, root) {
  const input = $(`#${id}`, root);
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
    toast(t('copied'));
  } catch {
    input.select();
  }
}

async function startSharedFromLocal() {
  const local = state.store;
  const m = me();
  if (!CONFIG || !m) return;
  try {
    const store = new SharedStore(CONFIG);
    const session = await store.createCircle(m.name, m.days);
    local.forget?.();
    closeSheet();
    startShared(session, store);
    openInvite();
  } catch (err) {
    console.warn(err);
    toast(t('syncError'));
  }
}

function changeLang(next) {
  settings.lang = next;
  storage.set('noor.settings', settings);
  setLang(next);
  const settingsOpen = !sheet.hidden && sheet.querySelector('.settings');
  if (state.store?.mode === 'demo') {
    for (const m of state.members) m.name = t(m.id === 'demo-me' ? 'demoMe' : 'demoFriend');
    for (const m of state.store.members) m.name = t(m.id === 'demo-me' ? 'demoMe' : 'demoFriend');
  }
  if (state.screen === 'main') showMain();
  else if (state.screen === 'welcome') showWelcome();
  else if (state.screen === 'join' && app.dataset.circle) showJoin(app.dataset.circle);
  if (settingsOpen) openSettings();
}

function armTwice(button, label, action) {
  if (button.dataset.armed) {
    action();
    return;
  }
  button.dataset.armed = '1';
  button.textContent = label;
}

// ---------- events ----------

let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3400);
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'checkin') {
    if (me()?.days[state.today] !== undefined) openToday();
  } else if (act === 'yes') checkIn();
  else if (act === 'no') openNotYet();
  else if (act === 'yesterday') openAsk(L.addDays(state.today, -1));
  else if (act === 'day') openDay(el.dataset.day);
  else if (act === 'cal-prev' || act === 'cal-next') {
    state.calMonth = L.addMonths(state.calMonth, act === 'cal-prev' ? -1 : 1);
    renderCalendar(me());
  }
  else if (act === 'settings') openSettings();
  else if (act === 'invite') openInvite();
  else if (act === 'nudge') nudge(el.dataset.id);
  else if (act === 'start-shared') startSharedFromLocal();
  else if (act === 'lang') changeLang(el.dataset.lang);
  else if (act === 'solo') begin(false);
  else if (act === 'start-own') showWelcome();
  else if (act === 'claim') {
    startShared({ circleId: app.dataset.circle, memberId: el.dataset.id }, app.joinStore);
    toast(t('welcomeBack', { name: el.dataset.name }));
  }
});

sheet.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-pages]');
  if (chip) {
    choosePages(Number(chip.dataset.pages), chip.closest('.pages').dataset.day);
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'close') closeSheet();
  else if (act === 'ask-yes') {
    if (el.dataset.day === state.today) checkIn();
    else markPastDay(el.dataset.day, el);
  } else if (act === 'ask-no') {
    if (el.dataset.day === state.today) openNotYet();
    else closeSheet();
  } else if (act === 'remove-day') armTwice(el, t('removeConfirm'), () => {
    clearMyDay(el.dataset.day);
    closeSheet();
    toast(t('dayRemoved'));
  });
  else if (act === 'undo') armTwice(el, t('undoConfirm'), () => {
    clearMyDay(state.today);
    closeSheet();
  });
  else if (act === 'reset') armTwice(el, t('resetConfirm'), () => {
    for (const key of ['noor.local', 'noor.session', 'noor.cache']) storage.del(key);
    location.reload();
  });
  else if (act === 'copy') copyFrom(el.dataset.target, sheet);
  else if (act === 'share-invite') shareText(t('inviteText', { url: inviteLink() }));
  else if (act === 'invite') openInvite();
  else if (act === 'install') install();
  else if (act === 'start-shared') startSharedFromLocal();
  else if (act === 'lang') changeLang(el.dataset.lang);
  else if (act === 'sound') {
    settings.sound = el.dataset.on === '1';
    storage.set('noor.settings', settings);
    for (const b of sheet.querySelectorAll('[data-act="sound"]')) b.setAttribute('aria-pressed', String(b === el));
    if (settings.sound) {
      fx.chime('soft');
      fx.buzz([15]);
    }
  }
});

sheet.addEventListener('change', (e) => {
  if (e.target.id !== 'pages-other') return;
  const pages = Math.round(Number(e.target.value));
  if (pages >= 1 && pages <= 604) {
    choosePages(pages, e.target.closest('.pages').dataset.day);
    e.target.value = pages;
    e.target.classList.add('on');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheet.hidden) closeSheet();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});
addEventListener('online', renderBanner);
addEventListener('offline', renderBanner);
setInterval(() => {
  if (state.screen === 'main' && me()) {
    if (L.appDay() !== state.today) render();
    else renderHero(me());
  }
}, 30000);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------- start ----------

function boot() {
  if (window.NOOR_DEMO || location.hash === '#demo') {
    startDemo();
    return;
  }
  const params = new URLSearchParams(location.hash.slice(1));
  const join = params.get('join');
  const memberHint = params.get('me');
  if (join) history.replaceState(null, '', location.pathname + location.search);
  const session = storage.get('noor.session', null);
  let note = '';
  if (join && CONFIG) {
    if (session?.circleId === join && (!memberHint || memberHint === session.memberId)) startShared(session);
    else showJoin(join, memberHint);
    return;
  }
  if (join) note = t('noSharing');
  if (session && CONFIG) {
    startShared(session);
    return;
  }
  const local = new LocalStore();
  if (local.profile) {
    startLocal(local);
    if (note) toast(note);
    return;
  }
  showWelcome(note);
}

boot();

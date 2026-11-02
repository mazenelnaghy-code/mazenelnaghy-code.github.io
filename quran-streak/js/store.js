// Where streaks live: on this phone only (LocalStore), or shared with friends through Firestore (SharedStore).
import { addDays, isDay } from './logic.js';

const KEY_LOCAL = 'noor.local';

export const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

export const COLORS = ['#E8B84A', '#4FC7B5', '#E88AA6', '#7FB2FF', '#B79CFF', '#F29A5B'];

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomId(length) {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => ID_CHARS[b % ID_CHARS.length]).join('');
}

/** Only valid days, each with a whole number of pages (0 when the pages weren't given). */
export function cleanDays(days) {
  const out = {};
  for (const [day, pages] of Object.entries(days || {})) {
    if (isDay(day)) out[day] = Number.isFinite(pages) && pages > 0 ? Math.min(Math.round(pages), 999) : 0;
  }
  return out;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

export class LocalStore {
  mode = 'local';

  constructor() {
    this.data = storage.get(KEY_LOCAL, null);
    this.listener = null;
  }

  get profile() {
    return this.data;
  }

  meId() {
    return this.data?.me.id ?? null;
  }

  create(name) {
    this.data = { me: { id: randomId(12), name, color: COLORS[0] }, days: {} };
    this.save();
  }

  forget() {
    this.data = null;
    storage.del(KEY_LOCAL);
  }

  subscribe(listener) {
    this.listener = listener;
    this.emit();
    return () => {
      this.listener = null;
    };
  }

  emit() {
    if (this.listener && this.data) this.listener([{ ...this.data.me, days: { ...this.data.days } }], { fromServer: true });
  }

  save() {
    storage.set(KEY_LOCAL, this.data);
    this.emit();
  }

  async setDay(day, pages) {
    this.data.days[day] = pages;
    this.save();
  }

  async clearDay(day) {
    delete this.data.days[day];
    this.save();
  }

  async rename(name) {
    this.data.me.name = name;
    this.save();
  }
}

export class SharedStore {
  mode = 'shared';

  constructor(config) {
    this.config = config;
    this.session = null;
    this.loading = null;
  }

  ready() {
    this.loading ??= (async () => {
      const fb = await import('../vendor/firebase.js');
      const { emulator, ...options } = this.config;
      const app = fb.initializeApp(options);
      let db;
      try {
        db = fb.initializeFirestore(app, {
          localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }),
        });
      } catch {
        db = fb.initializeFirestore(app, {});
      }
      if (emulator) fb.connectFirestoreEmulator(db, emulator.host, emulator.port);
      this.fb = fb;
      this.db = db;
    })();
    return this.loading;
  }

  circleRef(circleId) {
    return this.fb.doc(this.db, 'circles', circleId);
  }

  memberRef(circleId, memberId) {
    return this.fb.doc(this.db, 'circles', circleId, 'members', memberId);
  }

  mine() {
    return this.memberRef(this.session.circleId, this.session.memberId);
  }

  use(session) {
    this.session = session;
  }

  meId() {
    return this.session?.memberId ?? null;
  }

  async getCircle(circleId) {
    await this.ready();
    const snap = await withTimeout(this.fb.getDoc(this.circleRef(circleId)), 15000);
    return snap.exists() ? snap.data() : null;
  }

  async getMembers(circleId) {
    await this.ready();
    const snap = await withTimeout(this.fb.getDocs(this.fb.collection(this.db, 'circles', circleId, 'members')), 15000);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async createCircle(name, days) {
    await this.ready();
    const circleId = randomId(20);
    const memberId = randomId(12);
    const batch = this.fb.writeBatch(this.db);
    batch.set(this.circleRef(circleId), { by: name, createdAt: this.fb.serverTimestamp() });
    batch.set(this.memberRef(circleId, memberId), {
      name, color: COLORS[0], joinedAt: this.fb.serverTimestamp(), days: cleanDays(days),
    });
    await withTimeout(batch.commit(), 15000);
    return { circleId, memberId };
  }

  async joinCircle(circleId, name, days, takenColors = []) {
    await this.ready();
    const color = COLORS.find((c) => !takenColors.includes(c)) ?? COLORS[takenColors.length % COLORS.length];
    const memberId = randomId(12);
    await withTimeout(this.fb.setDoc(this.memberRef(circleId, memberId), {
      name, color, joinedAt: this.fb.serverTimestamp(), days: cleanDays(days),
    }), 15000);
    return { circleId, memberId };
  }

  async subscribe(listener, onError) {
    await this.ready();
    const members = this.fb.collection(this.db, 'circles', this.session.circleId, 'members');
    return this.fb.onSnapshot(
      members,
      (snap) => listener(snap.docs.map((d) => ({ id: d.id, ...d.data() })), { fromServer: !snap.metadata.fromCache }),
      onError,
    );
  }

  async setDay(day, pages) {
    await this.ready();
    return this.fb.updateDoc(this.mine(), new this.fb.FieldPath('days', day), pages);
  }

  async clearDay(day) {
    await this.ready();
    return this.fb.updateDoc(this.mine(), new this.fb.FieldPath('days', day), this.fb.deleteField());
  }

  async rename(name) {
    await this.ready();
    return this.fb.updateDoc(this.mine(), { name });
  }
}

/** Example days for trying Noor out: your 29-day streak (one tap away from a month) and a friend who read today. */
export class DemoStore {
  mode = 'demo';

  constructor(today, names) {
    const pages = [0, 2, 5, 10, 20];
    const me = {};
    for (let i = -46; i <= -1; i++) if (i !== -30) me[addDays(today, i)] = pages[Math.abs(i * 7) % 5];
    const friend = {};
    for (let i = -21; i <= 0; i++) if (i !== -12) friend[addDays(today, i)] = pages[Math.abs(i * 3) % 5];
    this.members = [
      { id: 'demo-me', name: names.me, color: COLORS[0], days: me, order: 0 },
      { id: 'demo-friend', name: names.friend, color: COLORS[1], days: friend, order: 1 },
    ];
  }

  meId() {
    return 'demo-me';
  }

  subscribe(listener) {
    this.listener = listener;
    this.emit();
    return () => {};
  }

  emit() {
    this.listener?.(this.members.map((m) => ({ ...m, days: { ...m.days } })), { fromServer: true });
  }

  async setDay(day, pages) {
    this.members[0].days[day] = pages;
    this.emit();
  }

  async clearDay(day) {
    delete this.members[0].days[day];
    this.emit();
  }

  async rename(name) {
    this.members[0].name = name;
    this.emit();
  }
}

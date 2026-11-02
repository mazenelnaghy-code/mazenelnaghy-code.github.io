// The night sky. Every reader is one arm of a spiral galaxy; each day they read is a star on their arm,
// the first day near the centre. Days read in a row are joined like a constellation, and days that
// everyone read get a golden halo. A missed day stays a faint dot, so the gap is visible.
import { addDays, daysBetween, readDays, sharedDays } from './logic.js';

const TURN = 10.5; // radians each arm winds from the centre to the edge
const MIN_SPAN = 30; // the galaxy grows outward through the first month, then fills the sky
const SPIN = 0.018; // radians per second

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export class Sky {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.links = [];
    this.sprites = new Map();
    this.visible = true;
    this.raf = 0;
    this.last = 0;
    this.t0 = performance.now();
    this.flash = null;
    this.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    new ResizeObserver(() => this.resize()).observe(canvas);
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.start();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => this.start());
  }

  /** flashId: the reader whose star for today should burst into view. */
  update({ members, today, flashId }) {
    this.members = members;
    this.today = today;
    if (flashId) this.flash = { id: flashId, at: performance.now() };
    this.layout();
    this.draw(performance.now());
    this.start();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.bg = null;
    this.layout();
    this.draw(performance.now());
  }

  layout() {
    this.stars = [];
    this.links = [];
    if (!this.members?.length || !this.w) return;
    const lists = this.members.map((m) => readDays(m.days, this.today));
    const first = lists.flat().sort()[0] ?? this.today;
    const span = daysBetween(first, this.today);
    const grow = Math.max(span, MIN_SPAN);
    const shared = this.members.length > 1 ? new Set(sharedDays(lists)) : new Set();
    const radius = Math.min(this.w, this.h) / 2 - 16;
    const cx = this.w / 2;
    const cy = this.h / 2;
    this.members.forEach((m, k) => {
      const phase = -Math.PI / 2 + (2 * Math.PI * k) / this.members.length;
      let prev = null;
      for (let i = 0; i <= span; i++) {
        const day = addDays(first, i);
        const along = Math.pow((i + 1) / (grow + 1), 0.7);
        const r = radius * (0.08 + 0.92 * along);
        const angle = phase + TURN * along;
        const rnd = random(hash(m.id + day));
        const pages = m.days[day];
        const star = {
          x: cx + Math.cos(angle) * r + (rnd() - 0.5) * 7,
          y: cy + Math.sin(angle) * r * 0.86 + (rnd() - 0.5) * 7,
          read: pages !== undefined,
          color: m.color,
          id: m.id,
          today: day === this.today,
          together: pages !== undefined && shared.has(day),
          size: 1.3 + (pages > 0 ? (Math.min(pages, 20) / 20) * 1.6 : 0),
          twinkle: rnd() * Math.PI * 2,
        };
        this.stars.push(star);
        if (star.read && prev?.read) this.links.push([prev, star]);
        prev = star;
      }
    });
  }

  sprite(color) {
    let s = this.sprites.get(color);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.1, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.26, color);
    glow.addColorStop(0.55, rgba(color, 0.25));
    glow.addColorStop(1, rgba(color, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, 64, 64);
    this.sprites.set(color, s);
    return s;
  }

  paintBackground() {
    const { w, h } = this;
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);
    const sky = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    sky.addColorStop(0, '#1B2766');
    sky.addColorStop(0.55, '#0E1638');
    sky.addColorStop(1, '#070B1C');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (const [x, y, r, col] of [[0.22, 0.28, 0.55, 'rgba(79,199,181,0.08)'], [0.8, 0.75, 0.6, 'rgba(183,156,255,0.08)']]) {
      const cloud = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
      cloud.addColorStop(0, col);
      cloud.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = cloud;
      g.fillRect(0, 0, w, h);
    }
    const rnd = random(7);
    for (let i = 0; i < 170; i++) {
      g.fillStyle = `rgba(220,226,255,${0.12 + rnd() * 0.5})`;
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, 0.3 + rnd() * 0.9, 0, Math.PI * 2);
      g.fill();
    }
    const core = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.22);
    core.addColorStop(0, 'rgba(247,220,148,0.26)');
    core.addColorStop(1, 'rgba(247,220,148,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, w, h);
    // A crescent in the corner, cut on its own canvas so the cut doesn't erase the sky.
    const moon = document.createElement('canvas');
    moon.width = moon.height = 40;
    const m = moon.getContext('2d');
    m.fillStyle = '#F7DC94';
    m.beginPath();
    m.arc(20, 20, 11, 0, Math.PI * 2);
    m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath();
    m.arc(25, 16, 10, 0, Math.PI * 2);
    m.fill();
    const halo = g.createRadialGradient(w - 34, 32, 0, w - 34, 32, 34);
    halo.addColorStop(0, 'rgba(247,220,148,0.18)');
    halo.addColorStop(1, 'rgba(247,220,148,0)');
    g.fillStyle = halo;
    g.fillRect(w - 80, 0, 80, 80);
    g.drawImage(moon, w - 54, 12);
    this.bg = c;
  }

  draw(now) {
    const { ctx, w, h } = this;
    if (!w) return;
    if (!this.bg) this.paintBackground();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const t = (now - this.t0) / 1000;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.motion ? t * SPIN : 0);
    ctx.translate(-w / 2, -h / 2);
    ctx.lineWidth = 0.7;
    for (const [a, b] of this.links) {
      ctx.strokeStyle = rgba(a.color, 0.32);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(200,210,255,0.22)';
    for (const s of this.stars) {
      if (s.read) continue;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    const gold = this.sprite('#F7DC94');
    for (const s of this.stars) {
      if (!s.read) continue;
      const tw = this.motion ? 0.8 + 0.2 * Math.sin(t * 1.7 + s.twinkle) : 1;
      let size = s.size * tw;
      if (s.today && this.motion) size *= 1 + 0.15 * Math.sin(t * 3.2);
      const f = this.flash && s.today && s.id === this.flash.id ? Math.min((now - this.flash.at) / 1400, 1) : 1;
      if (f < 1) {
        size *= 1 + 2.2 * (1 - f);
        ctx.strokeStyle = rgba(s.color, 0.7 * (1 - f));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4 + 40 * f, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (s.together) {
        ctx.globalAlpha = 0.5 * tw;
        const halo = size * 9;
        ctx.drawImage(gold, s.x - halo / 2, s.y - halo / 2, halo, halo);
        ctx.globalAlpha = 1;
      }
      const d = size * 7;
      ctx.drawImage(this.sprite(s.color), s.x - d / 2, s.y - d / 2, d, d);
    }
    ctx.restore();
    if (this.flash && now - this.flash.at > 1400) this.flash = null;
  }

  start() {
    if (!this.motion) {
      this.draw(performance.now());
      return;
    }
    if (this.raf || !this.visible || document.hidden) return;
    const tick = (now) => {
      if (!this.visible || document.hidden) {
        this.raf = 0;
        return;
      }
      if (now - this.last >= 33) {
        this.last = now;
        this.draw(now);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}

// The reward moment: a burst of golden sparks, a soft chime and a short vibration.

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let canvas = null;
let ctx = null;
let sparks = [];
let rings = [];
let raf = 0;

function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureCanvas() {
  if (canvas) return;
  canvas = document.getElementById('fx');
  ctx = canvas.getContext('2d');
  fit();
  addEventListener('resize', fit);
}

function sparkle(x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.fill();
  ctx.restore();
}

function step() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  rings = rings.filter((ring) => ++ring.age < ring.life);
  for (const ring of rings) {
    if (ring.age <= 0) continue; // a delayed ring hasn't started yet
    const p = ring.age / ring.life;
    ctx.strokeStyle = `rgba(247,220,148,${0.6 * (1 - p)})`;
    ctx.lineWidth = 2.5 * (1 - p) + 0.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.from + (ring.to - ring.from) * (1 - (1 - p) ** 3), 0, Math.PI * 2);
    ctx.stroke();
  }
  sparks = sparks.filter((s) => ++s.age < s.life);
  for (const s of sparks) {
    s.vx *= 0.955;
    s.vy = s.vy * 0.955 + 0.09;
    s.x += s.vx;
    s.y += s.vy;
    s.rot += s.spin;
    ctx.globalAlpha = Math.min(1, 2 * (1 - s.age / s.life));
    ctx.fillStyle = s.color;
    if (s.star) sparkle(s.x, s.y, s.size * 1.8, s.rot);
    else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  raf = sparks.length || rings.length ? requestAnimationFrame(step) : 0;
}

/** Sparks flying out from (x, y), in screen pixels. */
export function burst(x, y, { count = 90, power = 1, colors = ['#FFF6DD', '#F7DC94', '#E8B84A', '#C9973A'] } = {}) {
  ensureCanvas();
  const n = reduceMotion() ? Math.round(count / 5) : count;
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (2 + Math.random() * 8.5) * power;
    sparks.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      age: 0,
      life: 45 + Math.random() * 55,
      size: 1.4 + Math.random() * 2.6,
      color: colors[i % colors.length],
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      star: Math.random() < 0.5,
    });
  }
  if (!reduceMotion()) {
    rings.push({ x, y, from: 40, to: 190 * power, age: 0, life: 42 });
    rings.push({ x, y, from: 20, to: 120 * power, age: -8, life: 50 });
  }
  if (!raf) raf = requestAnimationFrame(step);
}

let audio = null;

function tone(freq, start, length, volume, type = 'sine') {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** A soft bell, made in the browser: 'check' after reading, 'milestone' for a new badge, 'soft' when a friend reads. */
export function chime(kind = 'check') {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime + 0.02;
    if (kind === 'milestone') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.11, 1.6, 0.13));
      tone(2093, t + 0.44, 1.8, 0.03, 'triangle');
    } else if (kind === 'soft') {
      tone(880, t, 0.9, 0.06);
      tone(1318.5, t + 0.08, 1, 0.03);
    } else {
      tone(659.25, t, 1.3, 0.15);
      tone(987.77, t + 0.09, 1.5, 0.11);
      tone(1318.5, t + 0.18, 1.7, 0.05, 'triangle');
    }
  } catch {}
}

export function buzz(pattern = [18, 40, 28]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

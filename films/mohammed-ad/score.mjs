// Synthesized score + SFX for the Mohammed Boudrioua ad. 120 BPM, A minor (Am–F–C–G).
// Usage: node films/mohammed-ad/score.mjs <out.wav>
import fs from "node:fs";

const SR = 48000, DUR = 21, BEAT = 0.5;
const N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N), RV = new Float32Array(N);

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = mulberry32(11);
const noise = () => rnd() * 2 - 1;
function biquad() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, type, f, q) => {
    const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}
function voice(t0, len, gain, pan, send, fn) {
  const s0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && s0 + i < N; i++) {
    if (s0 + i < 0) continue;
    const v = fn(i / SR, i) * gain;
    L[s0 + i] += v * gl; R[s0 + i] += v * gr; RV[s0 + i] += v * send;
  }
}
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// --- Instruments -----------------------------------------------------------
function kick(t, g = 1) {
  let ph = 0;
  voice(t, 0.45, g, 0, 0.02, (x) => { const f = 45 + 110 * Math.exp(-x / 0.03); ph += 2 * Math.PI * f / SR; return Math.tanh(2 * Math.sin(ph) * Math.exp(-x / 0.16)) + (x < 0.003 ? noise() * 0.4 : 0); });
}
function clap(t, g = 1) {
  const bp = biquad();
  voice(t, 0.3, g, 0, 0.4, (x) => { const e = [0, 0.011, 0.022].reduce((a, d) => a + (x >= d ? Math.exp(-(x - d) / (d === 0.022 ? 0.09 : 0.008)) : 0), 0); return bp(noise(), "bp", 1300, 1.2) * e * 1.6; });
}
function hat(t, g = 1, pan = 0.25) {
  const hp = biquad();
  voice(t, 0.08, g, pan, 0.1, (x) => hp(noise(), "hp", 8000, 0.8) * Math.exp(-x / 0.018));
}
function bass(t, midi, len, g = 1) {
  const lp = biquad(); const f = hz(midi);
  voice(t, len, g, 0, 0, (x) => {
    let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * f * h * x) / h;
    const env = Math.min(1, x / 0.004) * Math.exp(-x / 0.25);
    return lp(s, "lp", 180 + 900 * Math.exp(-x / 0.06), 0.9) * env;
  });
}
function pluck(t, midi, g = 1, pan = 0) {
  const f = hz(midi);
  voice(t, 0.5, g, pan, 0.5, (x) => (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(4 * Math.PI * f * x) * Math.exp(-x / 0.04)) * Math.min(1, x / 0.002) * Math.exp(-x / 0.14));
}
function pad(t0, len, notes, g = 1) {
  const lp = biquad();
  voice(t0, len, g, 0, 0.6, (x) => {
    let s = 0;
    for (const m of notes) for (const d of [-0.11, 0.09]) { const ph = (hz(m) * (1 + d / 100) * x) % 1; s += 2 * ph - 1; }
    const env = Math.min(1, x / (len * 0.8)) * Math.min(1, (len - x) / 0.05);
    return lp(s / notes.length, "lp", 300 + 2200 * (x / len), 0.7) * env * 0.5;
  });
}
function sweep(t0, t1, f0, f1, g = 1, shape = "rise", pan = 0) {
  const bp = biquad(), len = t1 - t0;
  voice(t0, len + 0.01, g, pan, 0.4, (x) => {
    const p = Math.min(1, x / len), f = f0 * Math.pow(f1 / f0, p);
    const env = shape === "rise" ? Math.pow(p, 2) * (p > 0.98 ? (1 - p) / 0.02 : 1) : Math.pow(Math.sin(Math.PI * p), 2);
    return bp(noise(), "bp", f, 2) * env * 1.5;
  });
}
function key(t, g = 1, pan = 0) { // keyboard tick
  const bp = biquad();
  voice(t, 0.04, g, pan, 0.05, (x) => bp(noise(), "bp", 4200 + 600 * Math.sin(t * 50), 3) * Math.exp(-x / 0.006) * 2);
}
function pop(t, g = 1) { let ph = 0; voice(t, 0.15, g, 0, 0.3, (x) => { const f = 300 + 700 * Math.exp(-x / 0.02); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * Math.exp(-x / 0.05); }); }
function thock(t, g = 1, pan = 0) { // card landing
  const lp = biquad(); let ph = 0;
  voice(t, 0.25, g, pan, 0.2, (x) => { const f = 90 + 120 * Math.exp(-x / 0.015); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * Math.exp(-x / 0.07) + lp(noise(), "lp", 1800, 0.7) * Math.exp(-x / 0.01) * 0.5; });
}
function chime(t, midi, g = 1, pan = 0) {
  const f = hz(midi);
  voice(t, 1.2, g, pan, 0.7, (x) => (Math.sin(2 * Math.PI * f * x) + 0.4 * Math.sin(2 * Math.PI * f * 2.01 * x) * Math.exp(-x / 0.2)) * Math.min(1, x / 0.002) * Math.exp(-x / 0.45));
}
function click(t, g = 1) {
  voice(t, 0.05, g, 0, 0.1, (x) => (Math.sin(2 * Math.PI * 2400 * x) * 0.6 + noise() * 0.5) * Math.exp(-x / 0.004));
  voice(t + 0.06, 0.04, g * 0.6, 0, 0.1, (x) => (Math.sin(2 * Math.PI * 1900 * x) * 0.6 + noise() * 0.4) * Math.exp(-x / 0.004));
}
function impact(t, g = 1) {
  let ph = 0; const lp = biquad();
  voice(t, 1.8, g, 0, 0.6, (x) => { const f = 32 + 40 * Math.exp(-x / 0.1); ph += 2 * Math.PI * f / SR; return Math.tanh(1.6 * (Math.sin(ph) * Math.exp(-x / 0.6) + lp(noise(), "lp", 2000 * Math.exp(-x / 0.1) + 100, 0.8) * Math.exp(-x / 0.2) * 0.7)); });
}

// --- Arrangement -----------------------------------------------------------
const CHORDS = [[57, [69, 72, 76]], [53, [65, 69, 72]], [48, [64, 67, 72]], [55, [67, 71, 74]]]; // Am F C G (bass, triad)
const chordAt = (t) => CHORDS[Math.floor(t / 2) % 4];

// Intro (0–2): pad swell, riser, typing, no drums.
pad(0, 2.0, [57, 64, 69, 72], 0.5);
sweep(0.6, 2.0, 300, 7000, 0.35, "rise");
for (let i = 0; i < 8; i++) key(0.08 + i * 0.07, 0.25, (i % 2 ? 0.2 : -0.2));
for (let i = 0; i < 9; i++) key(0.55 + i * 0.05, 0.12, 0.1 * (i % 3 - 1));
pluck(1.0, 81, 0.35); pluck(1.0, 76, 0.25);

// Groove (2–19).
for (let b = 4; b < 38; b++) {
  const t = b * BEAT, [bn, tri] = chordAt(t);
  const breakdown = t >= 12 && t < 16;
  if (!breakdown || b % 2 === 0) kick(t, breakdown ? 0.6 : 0.85);
  if (!breakdown && b % 2 === 1) clap(t, 0.35);
  hat(t + 0.25, 0.22, b % 2 ? 0.3 : -0.3);
  if (!breakdown) hat(t + 0.125, 0.08, 0.4);
  bass(t, bn - 12 + (b % 4 === 3 ? 12 : 0), 0.45, 0.42);
  bass(t + 0.25, bn - 12, 0.22, 0.3);
  const arp = [tri[0], tri[1], tri[2], tri[1] + 12];
  pluck(t, arp[b % 4] + (breakdown ? 12 : 0), 0.11, (b % 2 ? 0.35 : -0.35));
  pluck(t + 0.25, arp[(b + 2) % 4], 0.07, (b % 2 ? -0.35 : 0.35));
}
pad(12, 4, [69, 72, 76, 81], 0.25);

// Hits on the shotlist beats.
impact(2.0, 0.6); sweep(1.6, 2.0, 600, 4000, 0.25, "whoosh");
pop(2.5, 0.6);
sweep(3.6, 4.0, 500, 3500, 0.25, "whoosh", -0.2);
chime(5.0, 88, 0.18);
sweep(5.6, 6.0, 500, 3500, 0.25, "whoosh", 0.2);
[[6.5, 81], [8.0, 84], [9.5, 88]].forEach(([t, m], i) => { thock(t, 0.6, (i - 1) * 0.3); chime(t, m, 0.16, (i - 1) * 0.3); });
for (let i = 0; i < 5; i++) key(10.5 + i * 0.1, 0.3, (i - 2) * 0.15);
pop(11.0, 0.55); chime(11.0, 93, 0.14);
sweep(11.6, 12.0, 500, 3500, 0.25, "whoosh");
impact(12.0, 0.45); thock(12.0, 0.5);
pop(14.0, 0.5); chime(14.0, 84, 0.12);
sweep(15.4, 16.0, 300, 8000, 0.3, "rise");
impact(16.0, 0.7);
for (let i = 0; i < 8; i++) key(17.0 + i * 0.06, 0.18, (i % 2 ? 0.2 : -0.2));
pop(17.5, 0.4);
click(18.5, 0.5);
impact(19.0, 0.6); [69, 72, 76, 81].forEach((m, i) => pluck(19.0, m, 0.18, (i - 1.5) * 0.3)); pad(19.0, 1.6, [57, 64, 69, 72], 0.35);

// Reverb, tail fade, write 24-bit WAV.
function reverb(inp) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map((d) => { const n = Math.round(d * SR / 44100); return { d: n, b: new Float32Array(n), i: 0 }; });
  for (let n = 0; n < N; n++) { let s = 0; for (const c of combs) { const y = c.b[c.i]; c.b[c.i] = inp[n] + y * 0.78; c.i = (c.i + 1) % c.d; s += y; } out[n] = s * 0.25; }
  for (const d of [225, 556]) { const len = Math.round(d * SR / 44100), b = new Float32Array(len); let i = 0; for (let n = 0; n < N; n++) { const y = b[i], x = out[n]; b[i] = x + y * 0.5; out[n] = y - x * 0.5; i = (i + 1) % len; } }
  return out;
}
const wet = reverb(RV);
for (let n = 0; n < N; n++) { L[n] += wet[n] * 0.3; R[n] += wet[n] * 0.28; }
const fadeStart = Math.round(20.0 * SR);
for (let n = fadeStart; n < N; n++) { const g = Math.max(0, 1 - (n - fadeStart) / SR); L[n] *= g; R[n] *= g; }
let peak = 0; for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
const norm = 0.7 / peak, out = Buffer.alloc(44 + N * 6);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 6, 4); out.write("WAVEfmt ", 8);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 6, 28); out.writeUInt16LE(6, 32); out.writeUInt16LE(24, 34); out.write("data", 36); out.writeUInt32LE(N * 6, 40);
for (let n = 0; n < N; n++) for (const [c, buf] of [[0, L], [1, R]]) out.writeIntLE(Math.round(Math.tanh(buf[n] * norm * 1.1) * 8388607), 44 + n * 6 + c * 3, 3);
fs.writeFileSync(process.argv[2] || "score.wav", out);
console.log("wrote", process.argv[2]);

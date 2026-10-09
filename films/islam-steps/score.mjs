// Synthesized score: frame-drum (daf) percussion on a maqsum groove + SFX. No melodic instruments.
// Usage: node films/islam-steps/score.mjs <out.wav>
// Every hit is placed on the 120 BPM grid; measure.mjs then measures the grid back from the audio.
import fs from "node:fs";

const SR = 48000, DUR = 21, BPM = 120, BEAT = 60 / BPM;
const N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
const RV = new Float32Array(N); // reverb send (mono)

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = mulberry32(7);
const noise = () => rnd() * 2 - 1;

// RBJ biquad, coefficients recomputed per call so frequency can sweep.
function biquad() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, type, f, q) => {
    const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; } // band-pass (0 dB peak)
    const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

// Write a generated voice into the bus. fn(t, i) -> sample, len seconds.
function voice(t0, len, gain, pan, send, fn) {
  const s0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && s0 + i < N; i++) {
    if (s0 + i < 0) continue;
    const v = fn(i / SR, i) * gain;
    L[s0 + i] += v * gl; R[s0 + i] += v * gr; RV[s0 + i] += v * send;
  }
}

// --- Instruments -----------------------------------------------------------
function dum(t, g = 1) { // low daf stroke
  let ph = 0; const lp = biquad();
  voice(t, 0.7, g, 0, 0.25, (x) => {
    const f = 52 + 75 * Math.exp(-x / 0.035); ph += 2 * Math.PI * f / SR;
    const body = Math.sin(ph) * Math.exp(-x / 0.22);
    const slap = lp(noise(), "lp", 900, 0.7) * Math.exp(-x / 0.012) * 0.9;
    return Math.tanh(1.6 * (body + slap)) * 0.9;
  });
}
function tek(t, g = 1, pan = 0) { // rim / jingle stroke
  const bp = biquad(), hp = biquad();
  voice(t, 0.25, g, pan, 0.35, (x) => {
    const n = bp(noise(), "bp", 3600, 1.4) * Math.exp(-x / 0.028) * 1.8;
    const jingle = hp(noise(), "hp", 7000, 0.7) * Math.exp(-x / 0.07) * 0.35 * (1 + 0.5 * Math.sin(2 * Math.PI * 38 * x));
    const ping = Math.sin(2 * Math.PI * 1750 * x) * Math.exp(-x / 0.012) * 0.25;
    return n + jingle + ping;
  });
}
function wood(t, f, g = 1, pan = 0) { // pitched woodblock tick
  voice(t, 0.3, g, pan, 0.45, (x) => {
    const a = Math.min(1, x / 0.0008);
    return a * (Math.sin(2 * Math.PI * f * x) * Math.exp(-x / 0.055) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * x) * Math.exp(-x / 0.02));
  });
}
function boom(t, g = 1) { // sub impact
  let ph = 0; const lp = biquad();
  voice(t, 2.2, g, 0, 0.5, (x) => {
    const f = 30 + 34 * Math.exp(-x / 0.12); ph += 2 * Math.PI * f / SR;
    const sub = Math.sin(ph) * Math.exp(-x / 0.7);
    const crack = lp(noise(), "lp", 2400 * Math.exp(-x / 0.08) + 120, 0.8) * Math.exp(-x / 0.18) * 0.8;
    return Math.tanh(1.8 * (sub + crack));
  });
}
function sweep(t0, t1, f0, f1, g = 1, shape = "rise", pan = 0) { // filtered-noise riser / whoosh
  const bp = biquad(), bp2 = biquad(), len = t1 - t0;
  voice(t0, len + 0.01, g, pan, 0.4, (x) => {
    const p = Math.min(1, x / len);
    const f = f0 * Math.pow(f1 / f0, p);
    const env = shape === "rise" ? Math.pow(p, 2.2) * (p > 0.985 ? (1 - p) / 0.015 : 1) : Math.pow(Math.sin(Math.PI * p), 2);
    const s = noise();
    return (bp(s, "bp", f, 2.2) + 0.5 * bp2(s, "bp", f * 1.5, 3)) * env * 1.4;
  });
}
function drop(t, g = 1, pan = 0) { // water drop
  let ph = 0;
  voice(t, 0.35, g, pan, 0.6, (x) => {
    const f = 480 + 1500 * Math.exp(-x / 0.018); ph += 2 * Math.PI * f / SR;
    const a = Math.min(1, x / 0.001);
    return a * Math.sin(ph) * Math.exp(-x / 0.06);
  });
  let ph2 = 0;
  voice(t + 0.07, 0.25, g * 0.35, -pan, 0.6, (x) => {
    const f = 900 + 900 * Math.exp(-x / 0.012); ph2 += 2 * Math.PI * f / SR;
    return Math.sin(ph2) * Math.exp(-x / 0.04) * Math.min(1, x / 0.001);
  });
}

// --- Arrangement (seconds; all on the 8th-note grid of 0.25 s) -------------
// Maqsum (8ths): D T . T D . T .
function maqsum(bar0, g = 1) {
  const b = (k) => bar0 + k * BEAT / 2;
  dum(b(0), 0.8 * g); tek(b(1), 0.45 * g, -0.3); tek(b(3), 0.45 * g, 0.3); dum(b(4), 0.7 * g); tek(b(6), 0.5 * g, -0.2);
  tek(b(7), 0.18 * g, 0.4);
}
// Hook
boom(0, 1.0); tek(0.25, 0.35, 0.3); tek(0.75, 0.35, -0.3);
dum(1.0, 0.8); dum(1.5, 0.8);
for (let k = 0; k < 8; k++) tek(1.0 + k * 0.125, 0.12 + 0.05 * k, k % 2 ? 0.35 : -0.35);
sweep(1.55, 2.0, 500, 5000, 0.35, "whoosh");
// 01 Know
maqsum(2.0, 0.9); maqsum(4.0, 0.9);
sweep(2.25, 3.5, 250, 7000, 0.4, "rise");
boom(3.5, 0.55); wood(3.5, 560, 0.5);
sweep(4.55, 5.0, 800, 3500, 0.35, "whoosh", -0.2);
// 02 Believe — one tick per prophet, rising
[5.0, 5.25, 5.5, 5.75, 6.0].forEach((t, i) => wood(t, 620 + i * 90, 0.55, (i - 2) * 0.2));
boom(6.5, 0.7); wood(6.5, 1240, 0.7); dum(6.5, 0.7);
maqsum(5.0, 0.55); dum(7.0, 0.6);
sweep(7.0, 8.0, 300, 8000, 0.45, "rise");
// 03 Declare — groove drops out, sparse and reverent
boom(8.0, 1.0); dum(8.0, 0.9);
[8.25, 8.5, 8.75, 9.0, 9.25, 10.0, 10.25, 10.5, 10.75].forEach((t, i) => wood(t, i < 5 ? 880 : 990, 0.16, (i % 2 ? 0.3 : -0.3)));
dum(10.0, 0.75); dum(11.0, 0.45); dum(11.5, 0.45);
sweep(11.55, 12.0, 600, 4500, 0.35, "whoosh", 0.2);
// 04 Purify
drop(12.5, 0.9, 0); drop(13.5, 0.55, 0.3);
maqsum(13.0, 0.75); dum(14.0, 0.7);
sweep(14.0, 14.5, 300, 2400, 0.45, "whoosh");
// 05 Pray — five prayers, five rising ticks
maqsum(14.5, 0.85); maqsum(16.5, 0.85);
[15.0, 15.5, 16.0, 16.5, 17.0].forEach((t, i) => wood(t, 700 + i * 110, 0.6, (i - 2) * 0.25));
sweep(17.1, 17.5, 500, 6000, 0.35, "whoosh");
// Outro
boom(17.5, 0.95); dum(17.5, 0.8);
[18.25, 18.375, 18.5, 18.625, 18.75].forEach((t, i) => tek(t, 0.3, (i - 2) * 0.3));
tek(18.0, 0.35); dum(18.5, 0.5);
boom(19.0, 0.9); dum(19.0, 0.9); wood(19.0, 1240, 0.5);

// --- Reverb (Schroeder: 4 combs + 2 allpasses) on the send bus --------------
function reverb(inp) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d: Math.round(d * SR / 44100), b: new Float32Array(Math.round(d * SR / 44100)), i: 0 }));
  for (let n = 0; n < N; n++) {
    let s = 0;
    for (const c of combs) { const y = c.b[c.i]; c.b[c.i] = inp[n] + y * 0.8; c.i = (c.i + 1) % c.d; s += y; }
    out[n] = s * 0.25;
  }
  for (const d of [225, 556]) {
    const len = Math.round(d * SR / 44100), b = new Float32Array(len); let i = 0;
    for (let n = 0; n < N; n++) { const y = b[i]; const x = out[n]; b[i] = x + y * 0.5; out[n] = y - x * 0.5; i = (i + 1) % len; }
  }
  return out;
}
const wet = reverb(RV);
for (let n = 0; n < N; n++) { L[n] += wet[n] * 0.35; R[n] += wet[n] * 0.33; }

// Fade the tail, soft-clip, write 24-bit WAV.
const fadeStart = Math.round(20.0 * SR);
for (let n = fadeStart; n < N; n++) { const g = Math.max(0, 1 - (n - fadeStart) / (SR * 1.0)); L[n] *= g; R[n] *= g; }
let peak = 0; for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
const norm = 0.7 / peak;
const out = Buffer.alloc(44 + N * 6);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 6, 4); out.write("WAVEfmt ", 8);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 6, 28); out.writeUInt16LE(6, 32); out.writeUInt16LE(24, 34); out.write("data", 36); out.writeUInt32LE(N * 6, 40);
for (let n = 0; n < N; n++) for (const [c, buf] of [[0, L], [1, R]]) {
  const v = Math.round(Math.tanh(buf[n] * norm * 1.1) * 8388607);
  out.writeIntLE(v, 44 + n * 6 + c * 3, 3);
}
fs.writeFileSync(process.argv[2] || "score.wav", out);
console.log("wrote", process.argv[2], `${DUR}s @ ${BPM} BPM`);

// Measure the beat grid from the rendered audio (onset detection + least-squares grid fit).
// Usage: node films/islam-steps/measure.mjs <audio.wav> <beats.json> <beats.js>
// The film reads beats.js, so every visual hit lands on the grid measured from the actual sound.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const [wav, outJson, outJs] = process.argv.slice(2);
const SR = 48000;
const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-i", wav, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);

// High-passed energy envelope in 2 ms hops, then positive log-energy flux.
const HOP = 96, WIN = 384;
let prev = 0, hp = 0;
const y = new Float32Array(x.length);
for (let i = 0; i < x.length; i++) { hp = 0.95 * (hp + x[i] - prev); prev = x[i]; y[i] = hp; }
const env = [];
for (let s = 0; s + WIN < y.length; s += HOP) { let e = 0; for (let i = 0; i < WIN; i++) e += y[s + i] * y[s + i]; env.push(Math.log10(e / WIN + 1e-9)); }
const flux = env.map((v, i) => (i ? Math.max(0, v - env[i - 1]) : 0));
const onsets = [];
const thr = 0.5;
for (let i = 2; i < flux.length - 2; i++) {
  if (flux[i] > thr && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) {
    const t = (i * HOP + WIN / 2) / SR;
    if (!onsets.length || t - onsets[onsets.length - 1] > 0.06) onsets.push(+t.toFixed(4));
  }
}

// Fit t = t0 + k * eighth over onsets near the nominal 8th-note grid (120 BPM nominal).
const NOM = 0.25;
const pairs = onsets.map((t) => [Math.round(t / NOM), t]).filter(([k, t]) => Math.abs(t - k * NOM) < 0.03);
const n = pairs.length, sk = pairs.reduce((a, [k]) => a + k, 0), st = pairs.reduce((a, [, t]) => a + t, 0);
const skk = pairs.reduce((a, [k]) => a + k * k, 0), skt = pairs.reduce((a, [k, t]) => a + k * t, 0);
const eighth = (n * skt - sk * st) / (n * skk - sk * sk), t0 = (st - eighth * sk) / n;
const resid = pairs.map(([k, t]) => t - (t0 + k * eighth));
const rms = Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / n);
const period = eighth * 2;
const beats = Array.from({ length: 41 }, (_, i) => +(t0 + i * period).toFixed(4));
const data = { bpm: +(60 / period).toFixed(3), t0: +t0.toFixed(4), period: +period.toFixed(5), onGrid: n, onsets: onsets.length, residualMsRms: +(rms * 1000).toFixed(2), beats, onsetTimes: onsets };
fs.writeFileSync(outJson, JSON.stringify(data, null, 1));
fs.writeFileSync(outJs, `window.BEATS = ${JSON.stringify({ t0: data.t0, period: data.period, beats })};\n`);
console.log(JSON.stringify({ bpm: data.bpm, t0: data.t0, onsets: data.onsets, onGrid: n, residualMsRms: data.residualMsRms }));

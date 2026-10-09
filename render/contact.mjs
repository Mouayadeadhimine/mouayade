// Contact sheet: one frame per measured beat, tiled, each cell labelled with its beat and time.
// Viewport from VW/VH env (default 1080x1920).
// Usage: node render/contact.mjs <page.html> <beats.json> <out.png> [cols=8] [cellW=216] [offset=0]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const [page_, beatsFile, out, cols = "8", cellW = "216", offset = "0"] = process.argv.slice(2);
const { beats } = JSON.parse(fs.readFileSync(beatsFile, "utf8"));
const times = beats.slice(0, -1).map((b) => Math.max(0, b + +offset));
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: +(process.env.VW || 1080), height: +(process.env.VH || 1920) }, deviceScaleFactor: 1 });
await page.goto("file://" + path.resolve(page_));
await page.evaluate(() => window.ready);

const cw = +cellW, ch = Math.round(cw * (+(process.env.VH || 1920)) / (+(process.env.VW || 1080))), rows = Math.ceil(times.length / +cols);
const font = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
const vf = `scale=${cw}:${ch},drawtext=fontfile=${font}:text='%{eif\\:n\\:d}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6,tile=${cols}x${rows}:padding=4:color=gray`;
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "1", "-i", "-", "-vf", vf, "-frames:v", "1", out], { stdio: ["pipe", "inherit", "inherit"] });
for (const t of times) {
  await page.evaluate((x) => window.seek(x), t);
  ff.stdin.write(await page.screenshot({ type: "png" }));
}
ff.stdin.end();
await new Promise((res, rej) => ff.on("close", (c) => (c ? rej(new Error("ffmpeg " + c)) : res())));
console.log(`contact sheet: ${times.length} beats → ${out}`);
await browser.close();

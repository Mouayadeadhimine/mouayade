// Usage: node render/render.mjs <page.html> <out.mp4> <seconds> <fps> <w> <h> [audio.wav] [audioDelaySec] [blurSubframes] [shutter]
// blurSubframes > 1 renders that many sub-frames per frame across the shutter interval and averages them (true motion blur).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";

const [page_, out, secs, fps, W, H, audio, delay = "0", blur = "1", shutter = "0.5"] = process.argv.slice(2);
const SUB = Math.max(1, +blur);
const frames = Math.round(+secs * +fps);
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
await page.goto("file://" + path.resolve(page_) + (process.env.QUERY ? "?" + process.env.QUERY : ""));
const fontInfo = await page.evaluate(() => window.ready);
console.log("fonts before frame 0:", JSON.stringify(fontInfo));
if (!fontInfo.check) throw new Error("font not loaded before frame 0");

const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(+fps * SUB), "-i", "-"];
if (SUB > 1) args.push("-vf", `tmix=frames=${SUB},select=eq(mod(n\\,${SUB})\\,${SUB - 1}),setpts=N/(${fps}*TB)`);
if (audio) args.push("-i", audio, "-filter_complex", `[1:a]adelay=${+delay * 1000}:all=1,apad[a]`, "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-shortest");
args.push("-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", fps, "-movflags", "+faststart", out);
const ff = spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  for (let k = 0; k < SUB; k++) {
    // Sub-frames centred on the frame time across the shutter interval.
    const t = f / +fps + (SUB > 1 ? ((k + 0.5) / SUB - 0.5) * +shutter / +fps : 0);
    await page.evaluate(x => window.seek(x), Math.max(0, t));
    if (!ff.stdin.write(await page.screenshot({ type: "png" }))) await new Promise(r => ff.stdin.once("drain", r));
  }
}
ff.stdin.end();
await new Promise((res, rej) => ff.on("close", c => (c ? rej(new Error("ffmpeg " + c)) : res())));
console.log(`${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s (${((Date.now() - t0) / frames).toFixed(0)} ms/frame)`);
await browser.close();

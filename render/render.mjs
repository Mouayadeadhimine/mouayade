// Usage: node render/render.mjs <page.html> <out.mp4> <seconds> <fps> <w> <h> [audio.wav] [audioDelaySec]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";

const [page_, out, secs, fps, W, H, audio, delay = "0"] = process.argv.slice(2);
const frames = Math.round(+secs * +fps);
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
await page.goto("file://" + path.resolve(page_));
const fontInfo = await page.evaluate(() => window.ready);
console.log("fonts before frame 0:", JSON.stringify(fontInfo));
if (!fontInfo.check) throw new Error("font not loaded before frame 0");

const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", fps, "-i", "-"];
if (audio) args.push("-i", audio, "-filter_complex", `[1:a]adelay=${+delay * 1000}:all=1,apad[a]`, "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-shortest");
args.push("-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", fps, "-movflags", "+faststart", out);
const ff = spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate(t => window.seek(t), f / +fps);
  ff.stdin.write(await page.screenshot({ type: "png" }));
}
ff.stdin.end();
await new Promise((res, rej) => ff.on("close", c => (c ? rej(new Error("ffmpeg " + c)) : res())));
console.log(`${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s (${((Date.now() - t0) / frames).toFixed(0)} ms/frame)`);
await browser.close();

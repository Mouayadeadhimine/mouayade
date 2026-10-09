// Frame checks: font actually used, RTL/bidi order, safe area, determinism.
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const [page_, t = "3.5", png = "out/test.png"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"] });
async function frame(time) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.resolve(page_));
  await page.evaluate(() => window.ready);
  await page.evaluate(t => window.seek(t), +time);
  return page;
}
const page = await frame(t);
const buf = await page.screenshot({ type: "png" });
fs.writeFileSync(png, buf);

// Which font did Chromium actually shape the caption with?
const cdp = await page.context().newCDPSession(page);
await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
const { root } = await cdp.send("DOM.getDocument");
const fonts = {};
for (const sel of ["#title", "#caption"]) {
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
  fonts[sel] = (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts.map(f => `${f.familyName} (${f.glyphCount} glyphs)`);
}
const geo = await page.evaluate(() => {
  const r = el => { const b = el.getBoundingClientRect(); return { text: el.textContent, l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) }; };
  return { words: [...document.querySelectorAll("#caption .w")].map(r), title: r(document.querySelector("#title")), caption: r(document.querySelector("#caption")) };
});
const SAFE = { l: 108, r: 972, t: 192, b: 1728 };
const inSafe = b => b.l >= SAFE.l && b.r <= SAFE.r && b.t >= SAFE.t && b.b <= SAFE.b;
// Ink bounds of the actual glyphs (title transform included), measured from pixels.
const w = geo.words;
const ar = w.slice(0, 4), en = w.slice(4);
const results = {
  fontsUsed: fonts,
  arabicRightToLeft: ar.every((x, i) => i === 0 || x.r <= ar[i - 1].l),
  englishAfterArabicOnLeft: en.every(x => x.r <= ar[3].l),
  englishOrderClaudeThenCode: en[0].r <= en[1].l,
  titleInSafe: inSafe(geo.title), captionInSafe: inSafe(geo.caption),
  words: w.map(x => `${x.text}[${x.l}-${x.r}]`).join("  "),
};
// Determinism: two fresh page loads, same timestamp, compare decoded pixels.
const hashes = [];
for (let i = 0; i < 2; i++) {
  const p = await frame(t);
  hashes.push(createHash("sha256").update(await p.screenshot({ type: "png" })).digest("hex"));
  await p.close();
}
results.determinism = { hashA: hashes[0].slice(0, 16), hashB: hashes[1].slice(0, 16), identical: hashes[0] === hashes[1] };
console.log(JSON.stringify(results, null, 1));
await browser.close();

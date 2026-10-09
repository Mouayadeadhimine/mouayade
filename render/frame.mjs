import { chromium } from "playwright"; import path from "node:path";
const [page_, out, ...ts] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--font-render-hinting=none","--disable-lcd-text","--force-color-profile=srgb"] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto("file://" + path.resolve(page_)); await p.evaluate(() => window.ready);
let i=0; for (const t of ts) { await p.evaluate(x => window.seek(x), +t); await p.screenshot({ path: out.replace("%", i++) }); }
await b.close();

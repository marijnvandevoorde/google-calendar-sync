#!/usr/bin/env node
/* Rasterize icons/icon.svg into the PNG sizes the manifest & iOS need.
 * Uses Playwright's Chromium to render the SVG. Only needed if you change
 * the SVG — the generated PNGs are committed to the repo.
 *
 *   npm run icons
 */
"use strict";

const fs = require("fs");
const path = require("path");

let chromium;
try {
  chromium = require("playwright").chromium;
} catch (e) {
  console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const ICONS = path.resolve(__dirname, "..", "icons");
const svg = fs.readFileSync(path.join(ICONS, "icon.svg"), "utf8");
const OUT = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];

(async () => {
  const browser = await chromium.launch();
  for (const [name, size] of OUT) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const html =
      `<!doctype html><html><head><style>*{margin:0;padding:0}` +
      `html,body{width:${size}px;height:${size}px}svg{width:${size}px;height:${size}px;display:block}` +
      `</style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(ICONS, name) });
    await page.close();
    console.log("wrote", name, `${size}x${size}`);
  }
  await browser.close();
})();

#!/usr/bin/env node
/**
 * capture-screenshots.mjs — convert generated UI screenshot HTML files
 * into real PNG images using Playwright.
 *
 * Input:  packages/opa-editor/src/__tests__/ui/__screenshots__/*.html
 *          (produced by the UI screenshot Jest tests)
 * Output:  artifacts/ui-screenshots/*.png
 *
 * Usage:
 *   npx playwright install chromium   # once, in CI
 *   node tools/capture-screenshots.mjs
 *
 * Each HTML file records a viewport width hint in
 * <body data-screenshot-width="...">; it defaults to 1280 px.
 */

import { readdirSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SCREENSHOT_DIR = join(
  ROOT,
  'packages/opa-editor/src/__tests__/ui/__screenshots__',
);
const OUT_DIR = join(ROOT, 'artifacts', 'ui-screenshots');

async function main() {
  if (!existsSync(SCREENSHOT_DIR)) {
    console.error(
      `No screenshot directory at ${SCREENSHOT_DIR}.\n` +
        'Run the screenshot tests first:\n' +
        '  npm test -- --testPathPattern=screenshot',
    );
    process.exit(1);
  }

  const htmlFiles = readdirSync(SCREENSHOT_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => join(SCREENSHOT_DIR, f))
    .filter((f) => statSync(f).isFile())
    .sort();

  if (htmlFiles.length === 0) {
    console.error('No *.html screenshots found — nothing to capture.');
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const file of htmlFiles) {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2, // crisp screenshots for review
      });

      await page.goto(`file://${file}`);
      const widthHint = await page.$eval(
        'body',
        (el) =>
          parseInt(el.getAttribute('data-screenshot-width') ?? '1280', 10) ||
          1280,
      );
      await page.setViewportSize({ width: widthHint, height: 800 });

      const out = join(OUT_DIR, basename(file, '.html') + '.png');
      await page.screenshot({ path: out, fullPage: true });
      console.log(`✓ ${basename(file)} -> ${out}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\nCaptured ${htmlFiles.length} PNG screenshot(s) into ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

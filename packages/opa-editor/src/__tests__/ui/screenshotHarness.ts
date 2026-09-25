/**
 * UI screenshot harness (issue #14).
 *
 * Renders a React component tree in jsdom, optionally drives it into a
 * particular UI state, then writes the resulting live DOM (including
 * emotion-injected styles and open MUI portals) as a standalone HTML
 * "screenshot" file. These HTML files are:
 *
 *   1. Committed to the repo so reviewers can eyeball the UI without
 *      running a dev server (see `__screenshots__/`).
 *   2. Converted to real PNG images by the `ui-screenshots` CI workflow
 *      using Playwright, and uploaded as workflow artifacts.
 *
 * See docs/ui-testing.md.
 */

import * as fs from 'fs';
import * as path from 'path';
import { render, cleanup } from '@testing-library/react';

/** Directory where screenshot HTML files are written. */
export const SCREENSHOT_DIR = path.join(__dirname, '__screenshots__');

/**
 * Base CSS injected into every screenshot so the raw DOM dump is legible
 * when opened directly in a browser or captured by Playwright. Only
 * presentation niceties — the component's own styles are embedded
 * verbatim by emotion.
 */
const BASE_CSS = `
  html, body { margin: 0; }
  body {
    font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
    background: #fff;
    padding: 8px;
  }
`;

const REPO_URL = 'https://github.com/DevelApp-ai/OPA-Editor';

export interface ScreenshotOptions {
  /** Human-readable description of the captured UI state. */
  title: string;
  /** File name (without extension). Defaults to a slug of `title`. */
  name?: string;
  /** Viewport width hint, recorded for Playwright PNG capture. */
  width?: number;
  /**
   * Optional interactions to drive the UI into the desired state
   * (e.g. click Validate and await diagnostics). Runs after the initial
   * render and before the DOM is serialized.
   */
  setup?: () => void | Promise<void>;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Render a React element, run the optional setup interactions, then
 * serialize the live jsdom document (head styles + body) into a
 * standalone HTML file. Returns the generated file path.
 *
 * Use `screen` from @testing-library/react inside `setup` to interact
 * with the rendered page.
 */
export async function renderScreenshot(
  ui: React.ReactElement,
  options: ScreenshotOptions,
): Promise<string> {
  const { title } = options;
  const width = options.width ?? 1280;

  cleanup();
  render(ui);
  if (options.setup) {
    await options.setup();
  }

  // Emotion injects <style> tags into <head> — capture them so the
  // screenshot is styled identically to the running app.
  const headStyles = Array.from(document.head.querySelectorAll('style'))
    .map((el) => el.outerHTML)
    .join('\n    ');

  const bodyHtml = document.body.innerHTML;

  // Sanity check: refuse to write an empty screenshot.
  if (bodyHtml.trim().length === 0) {
    throw new Error(
      `Screenshot "${title}" is empty — refusing to record a blank UI state.`,
    );
  }

  const doc = `<!doctype html>
<!--
  Generated UI screenshot — do not edit by hand.
  UI state: ${escapeHtml(title)}
  Source: ${REPO_URL}
  Regenerate with: npm test -- --testPathPattern=screenshot
-->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — OPA Editor UI screenshot</title>
    <style>${BASE_CSS}</style>
    ${headStyles}
  </head>
  <body data-screenshot-width="${width}">
${bodyHtml}
  </body>
</html>
`;

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fileName = `${options.name ?? slug(title)}.html`;
  const filePath = path.join(SCREENSHOT_DIR, fileName);
  fs.writeFileSync(filePath, doc, 'utf8');

  cleanup();

  return filePath;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

# UI Testing with Screenshots

This document describes how the OPA Editor plugin keeps its UI under
test — and, crucially, how we capture **screenshots** of the UI so
contributors and reviewers can verify we are building a *useful* UI
without having to run a Backstage development server.

> Issue: [#14 — There is a need for UI testing with screenshots](https://github.com/DevelApp-ai/OPA-Editor/issues/14)

## Overview

The UI testing stack has three layers:

| Layer | What it does | Where it runs |
|-------|--------------|---------------|
| **Useful-UI contract tests** | Render the real component tree (jsdom) and assert the essential UI regions and state transitions exist and behave | `npm test` (CI unit-tests job) |
| **HTML screenshots** | Serialize the live DOM (with emotion styles and open portals) to standalone HTML files per UI state | `npm test -- --testPathPattern=screenshot` |
| **PNG screenshots** | Render each HTML file in headless Chromium (Playwright) at 2× scale and upload as CI artifacts | `UI Screenshots` workflow |

All three live in `packages/opa-editor/src/__tests__/ui/`.

## Useful-UI contract tests

`OpaEditorPage.ui.test.tsx` renders the full editor page with the
Backstage API and Monaco mocked, and asserts the UI a policy author
actually needs:

- the **domain picker** lists the registered domains,
- the **Rego editor** shows the policy template,
- **Validate** and **Publish** actions are present and labelled,
- the **diagnostics panel** shows backend validation results (errors,
  warnings, line/column info) and the backend-down error state,
- publishing produces **visible feedback** on both success and rejection,
- the editor is **editable**.

If any of these regress, the test fails before a screenshot can be
taken — a screenshot of a broken page proves nothing.

## HTML screenshots

`OpaEditorPage.screenshot.test.tsx` + `screenshotHarness.ts` render
each meaningful UI state and write a standalone HTML file to
`packages/opa-editor/src/__tests__/ui/__screenshots__/`:

| File | UI state |
|------|----------|
| `opa-editor-page--default.html` | Fresh page, default FinOps policy template |
| `opa-editor-page--diagnostics.html` | After **Validate**, showing L1/L2/L3 diagnostics |
| `opa-editor-page--published.html` | After a successful **Publish**, with revision feedback |
| `opa-editor-page--rejected.html` | After a rejected **Publish**, with domain-guard errors |
| `diagnostics-panel--errors.html` | The diagnostics panel in isolation with mixed severities |
| `domain-picker--open.html` | The domain picker with its dropdown open |

These files are self-contained (styles are embedded), committed to the
repo, and can be opened directly in any browser to review the UI.

The harness is intentionally strict: it **refuses to write an empty
screenshot** and each test asserts the expected content is present
*before* capturing, so the files cannot silently rot.

Regenerate them after changing any component:

```bash
npm test -- --testPathPattern=screenshot
```

## PNG screenshots (CI)

The [UI Screenshots workflow](../.github/workflows/ui-screenshots.yml)
runs on every PR, regenerates the HTML screenshots, converts them to
high-DPI PNGs with Playwright
([`tools/capture-screenshots.mjs`](../tools/capture-screenshots.mjs)),
and uploads them as a `ui-screenshots` workflow artifact (retained 30
days). Download the artifact from the PR checks to eyeball the UI.

To produce PNGs locally:

```bash
npm test -- --testPathPattern=screenshot
npm install --no-save playwright && npx playwright install chromium
node tools/capture-screenshots.mjs
# → artifacts/ui-screenshots/*.png
```

## Screenshots in the user documentation

On every push to `main`, the workflow also **publishes the PNGs into
`docs/images/`** and commits them, then triggers a rebuild of the GitHub
Pages site. The [User Guide](user-guide.md) embeds these images, so the
user documentation always shows screenshots of the *current* UI — when
a component changes, the next run on `main` replaces the images
automatically.

Details of the publish step:

- Only the `main` branch publishes; PR runs only upload the artifact.
- If the rendered PNGs are byte-identical, nothing is committed.
- The commit is pushed with `GITHUB_TOKEN`, whose pushes do **not**
  fire `push`-event workflows — that is why the workflow explicitly
  dispatches the Pages deploy (`workflow_dispatch` events *do* trigger
  workflows).

Note that these images are rendered from the **test harness**, in which
the Monaco editor is mocked as a plain `<textarea>` — they document
layout and states faithfully, but not the editor's syntax highlighting.

## Adding a new screenshot

1. Add a test case to `OpaEditorPage.screenshot.test.tsx`:

   ```tsx
   it('captures the new state', async () => {
     validateMock.mockResolvedValue({ ok: true, errors: [] });
     const file = await renderScreenshot(<OpaEditorPage />, {
       title: 'description of the state',
       name: 'opa-editor-page--new-state',
       width: 1280,
       setup: async () => {
         // drive the UI into the state, then assert it before capture
       },
     });
     expect(file).toContain('opa-editor-page--new-state.html');
   });
   ```

2. The HTML file is generated in CI when the screenshot tests run —
   nothing to commit by hand.

3. The PNG for the new state appears in the CI artifact automatically,
   and is published to `docs/images/` on the next push to `main`. If the
   user guide should show it, embed it there:

   ```markdown
   ![Description of the state](images/opa-editor-page--new-state.png)
   ```

## Scope & future work

- The Monaco editor itself is mocked as a plain `<textarea>` in jsdom —
  the real Monaco rendering is validated visually via the PNG
  artifacts only once a full Backstage app harness exists.
- A natural next step is a Backstage dev-app + Playwright end-to-end
  suite capturing the plugin inside a real app; the harness and CI
  plumbing here are designed to be reused for that.

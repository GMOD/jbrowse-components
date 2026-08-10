---
name: test-infrastructure
description: Browser and unit tests and WebGPU CI. Read when running or writing tests, or validating RPC.
---

# Test Infrastructure

Browser tests (Puppeteer) in `products/jbrowse-web/browser-tests/`; unit tests
(Jest) co-located as `*.test.ts`.

## Browser tests

Build first: `pnpm --filter @jbrowse/web build`.

```sh
node browser-tests/runner.ts                 # canvas2d (default)
node browser-tests/runner.ts --backend=webgl
node browser-tests/runner.ts --filter=alignments
node browser-tests/runner.ts --headed         # debug
node browser-tests/runner.ts --update-snapshots
```

~29 suites in `browser-tests/suites/` (alignments, variants, the synteny family,
dotplot, hic, gwas, methylation-modifications, svg-export, color-by-tag,
wiggle-color, main-thread-rpc, basic-lgv, …).

### Golden snapshots

Visual regression via pixelmatch (0.1% pixel-diff threshold), stored per backend
in `browser-tests/__snapshots__/{canvas2d,webgl,webgpu}/`. Cross-backend compare
(`compare-backends.ts`): identical / `<5%` similar / `≥5%` different. Intentional
change → `--update-snapshots`.

**Goldens never run in CI** — they encode one machine's rendering. The
*cross-backend gate* does, blocking, since 2026-08-04: `pnpm test:browser:gate:ci`
renders `CI_GATE_SUITES` (`crossBackendGate.ts`) with canvas2d and swiftshader
webgl in one run and diffs the two, so it needs no committed baseline. Scope and
its reasons live next to the list; `agent-docs/handoffs/cross-backend-gate-ci.md`
is what to read before widening it.

**The 10-25% blank-capture flake was `fullPage: true`** (fixed 2026-07-26).
Puppeteer implements `fullPage` by resizing the viewport to the scroll size and
restoring it afterwards; that resize invalidates the page raster, and under load
the capture comes back before the content has re-rastered — live app chrome
around a white content area, which reads as a large "regression". `pageSnapshot`
now takes a plain viewport screenshot. No golden changed: the app fills the
window, so every full-page golden is exactly 1280x800. A view that needs more
room gets a bigger viewport (`page.setViewport`) — never `fullPage`.

Measured on the alignments suite at concurrency 4: **5/5 runs failed 2-3 tests
with `fullPage`, 4/4 runs clean without it**, same build, same goldens. The DOM
was fully populated at capture time (displays reporting `data-display-drawn`,
ruler text in `innerText`) and an immediate re-capture matched, which is what ruled out a
paint gate as the fix. A single test run alone with `--test=` almost never
reproduces it — the blanking needs the concurrent browser churn.

Two goldens froze that flake in (`canvas2d/fullpage_methylation.png`,
`fullpage_modifications.png` are blank pages), so **still look at
`__snapshots__/<backend>/<name>.diff.png` before believing a number, and before
running `-u`.**

Goldens also carry ordinary drift from unrelated commits: after ~10 days of
alignments work every test still passed while the BAM golden sat at ~2.7% RMSE
(mostly toolbar chrome). So a diff percentage alone attributes nothing — check
whether your change can even reach the pixels in question.

### WebGL / WebGPU

- **WebGL** — fully supported (Chrome headless / Firefox), CI default.
- **WebGPU local** (Firefox real GPU): `--backend=webgpu --headed`; set
  `FIREFOX_NIGHTLY_PATH` or pass `--firefox=/path/to/binary` to locate the binary.
- **WebGPU CI** (Linux + lavapipe): install `mesa-vulkan-drivers`, run under
  `xvfb-run` with `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
  --backend=webgpu`. Chrome flags already set in `runner.ts`.
- **macOS** — real GPU, ~10× cost.

## Unit tests

Jest, co-located (`*.test.ts`), run with `pnpm test-ci`. Node-based and fast —
use for logic, config, RPC, and buffer packing; use browser tests for rendering
and UI.

## Wait signals

Two completion signals. **Do not** wait on `LoadingOverlay` text — it keeps the
literal `"Loading"` in the DOM at `opacity:0`, so a `textContent` check is always
true (this silently burned full snapshot timeouts).

- `data-testid="loading-overlay"` **absent** → data finished **fetching**
  (generic; used by `waitForLoadingToComplete` / `waitForDataLoaded` and the
  snapshot waits).
- `data-display-drawn="true"` → canvas finished **painting** (gated on
  `painted`, published by `DisplayChrome` from its **required** `testid` base
  prop, and by `RenderCanvas` for the two chrome-less views). The testid names
  the display TYPE and is **stable** — it used to gain a `-done` suffix on first
  paint, and ADR-065 removed that, so nothing composes readiness into an id any
  more.

  Don't hand-write the conjunction. `displayPainted(base)` /
  `displaySettled(base)` / `displayById(id)` come from `@jbrowse/capture`
  (re-exported by `@jbrowse/browser-test-utils`) for selector strings, and
  `findDisplayPainted` / `findAnyDisplayPainted` are the jest waits
  (`products/jbrowse-web/src/tests/util.tsx`) — the jest ones report *which*
  half failed, which "no element found" never could. See DISPLAYCHROME.md, "One
  element per display".

  For tests that pixel-match or screenshot the canvas element, the inner
  `<canvas>` carries a **static** selector (`hic_canvas`, `ld_canvas`,
  `variant_canvas`, `variant_matrix_canvas`): wait with `findDisplayPainted`,
  then read the static canvas selector. `canvasSnapshot` takes the exact
  selector — canvas captures are the most reliable.

## Image snapshots go stale invisibly

`jest-image-snapshot` writes `__image_snapshots__/*-snap.png` as plain files
beside the suite, **outside** jest's own obsolete-snapshot tracking. So a
snapshot whose test was renamed, deleted, or simply stopped calling
`expectCanvasMatch` is never reported by anything — verified by dropping a
fabricated `…-zzz-fake-orphan-probe-1-snap.png` into a snapshot dir and watching
a full run of that suite pass without a word. Two such orphans were found by
hand in `BigWig.test.tsx` alone, one of them ~30 commits old.

**The library ships a reporter for this and it must not be enabled here.**
`jest-image-snapshot/src/outdated-snapshot-reporter` (gated on
`JEST_IMAGE_SNAPSHOT_TRACK_OBSOLETE`) deletes every `-snap.png` in any directory
the run touched that the run did not itself write. Two properties make that
destructive in this repo:

- `__image_snapshots__` is shared per test *directory*, so one running test
  marks the whole directory live — and every `test.skip` in that directory then
  looks obsolete. There are several (`Alignments`, `ConfigurationEditor`,
  `JBrowse`, …), and regenerating a deleted golden means re-rendering it, which
  this repo only does after a *visually verified* change.
- It deletes on any run, including a filtered one, so `jest BigWig.test.tsx`
  with the flag set wipes every other jbrowse-web golden.

The **instrumentation** is safe on its own: setting the env var without
registering the reporter appends each compared file to
`.jest-image-snapshot-touched-files`, which can be diffed against what is on
disk. That needs a fully green `jest` run over the whole repo — a failing or
filtered run under-reports the touched set and every unreached snapshot reads
as an orphan.

## Troubleshooting

- **Stale build / `ChunkLoadError: Loading chunk N failed`** — rebuild:
  `rm -rf build && pnpm --filter @jbrowse/web build`.
- **Startup crash / `ERR_INSUFFICIENT_RESOURCES` / "HistoryService::Init() failed"**
  — corrupted Puppeteer cache: `rm -rf /tmp/puppeteer_* /tmp/org.chromium.*`.
- **"libpxbackend-1.0.so not found"** — system snap Chrome is broken; use
  Puppeteer's cached binary (`~/.cache/puppeteer/`).
- **Port 3333 in use (`EADDRINUSE`) / stray processes** —
  `fuser -k 3333/tcp && pkill -9 chrome firefox`. `runner.ts` also reaps stale
  automation browsers at startup (`killStaleTestBrowsers`, Linux-only) and
  force-kills its own launched browsers on exit.
- **Console errors** — runner forwards `[alignments]` / `[webgl-wiggle]` logs;
  add patterns in `runner.ts`.
- **A `waitFor` that burns its full 30s, blamed on a line that never ran.** In
  `products/jbrowse-web/src/tests`, `view` is typed but
  `view.tracks[0].displays[0]` is **`any`** — so a getter that does not exist on
  the display model typechecks fine and fails only at runtime. Jest then prints
  the *last* error with surrounding source, pointing several lines below the
  real one. This cost a long debug once: `display.sashimiSections` never existed
  (it is `sashimiArcSections`), but the reported error named `data.sashimiX1` on
  an unreached line. When a test touches more than a member or two off a
  display, annotate it with the real exported model type — e.g.
  `LinearAlignmentsDisplayModel` from `@jbrowse/plugin-alignments`, which
  jbrowse-web already depends on. `AlignmentGroupBy.test.tsx` is the worked
  example. Expect a batch of `noUncheckedIndexedAccess` errors that `any` was
  hiding. If a member looks plausible but resolves nowhere, suspect a
  pre-migration shape: the nested `PileupDisplay`/`SNPCoverageDisplay` sub-nodes
  were flattened into `LinearAlignmentsDisplay` (see `sessionMigrations`), and
  dead `xtest`s referenced them for years afterward.

### Cross-test memory growth is SwiftShader, not a JBrowse leak

(Measured 2026-05-29.) JBrowse disposes GL contexts 1:1 (`useRenderingBackend` unmount +
`pagehide`; `webgl2Hal.dispose()` frees every GL object) and the main JS heap
stays flat. The unbounded `~29 MB/cycle` is Chrome's **GPU-process RSS under
SwiftShader**, which never returns per-context memory to the OS — unfixable from
JS. Headless always falls back to SwiftShader (even with `--ignore-gpu-blocklist`);
only headed-on-a-real-GPU avoids it, so it is **not** a CI fix. Mitigation:
`runner.ts` recycles the browser per test (see
`adr-024-per-backend-snapshots-real-gpu.md`). Repro: enable `?webgl2-debug=1`
(or `window.DEBUG.webgl2=true`) telemetry and watch `--type=gpu-process` RSS via
`ps -o rss=,args=`.

A separate, lower-severity **product** leak (not a test-cleanliness problem,
since the browser recycles per test): closing a track retains its entire
detached `TrackContainer` subtree (~55 nodes, ~6 listeners/cycle), GC-rooted via
a leaked listener or the HAL-held canvas.

## Open follow-ups

- **Refresh the drifted goldens on a quiet worktree.** Last full run: the two
  blank methylation/modifications full-page goldens plus ~15 targeted ones
  (bigwig, hic, long-reads/inversions, multi-region, demo-inventory) fail
  deterministically against a clean build — real rendering drift since the
  Jul 16 refresh (`452396ab97`). Regenerating needs a worktree nobody else is
  rebuilding in, or the goldens capture another agent's uncommitted work.
- **`HiC mirrors on a reversed region` fails an assertion, not a snapshot**
  (`err vs mirrored-forward 577` should be well under `err vs forward 728`), and
  both `Variant Force Load` tests time out waiting for the Force-load button —
  the too-large gate never trips. Both reproduce run to run; neither is flake.
- **Profile the ~32s full-page synteny capture.** Now that `pageSnapshot` skips
  the viewport resize, re-measure before optimizing; canvas-only captures of the
  same view were the fast path.

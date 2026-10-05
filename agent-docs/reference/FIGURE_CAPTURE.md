---
name: figure-capture
description: Why does a committed web or desktop figure disagree with what you meant, and how do you regenerate one? Covers misplaced callouts, readiness races, blank captures, software-rasterized renders, and the selenium harness for the packaged Electron app.
audience: internal
kind: operations
---

# Capturing a figure

Four ways a committed web PNG disagrees with what you meant, all in
`website/scripts/generate-screenshots.ts` and the browser-test suite rather than
the app: a callout resolves somewhere unintended, the capture lands before the
data arrived, the capture path returns something the renderer never drew, or
every WebGL draw runs on the CPU. **A figure that looks wrong is a harness bug
until the render is ruled out.** The desktop figures come from a separate
selenium harness over the packaged Electron app ("Desktop figures").

## Where a callout lands

`website/CLAUDE.md` states the rule: never hand-measure a callout position; every
annotation `anchor`s, and a click anchors too. The vocabulary is
`AnnotationAnchor` in `products/jbrowse-capture/src/annotationOverlay.ts`,
shared with the desktop harness; prefer `trackId`+`loc`, then `graphNode`,
`selector`, `text`. `check-specs.ts` ratchets what is left unanchored.

Each of these produces a plausible figure rather than an error:

- **A label that points at something is one annotation**: `leader: true` on a
  `text` annotation. A pill's width is known only once its text is measured in the
  page, so a text plus a separate arrow can only guess it. `countDetachableLabels`
  (`screenshot-spec-rules.ts`) ratchets such pairs; lower `LEADER_BASELINE` when
  converting one.
- **A caption parked in a corner or margin points at nothing**; anchoring
  relocates it. Anchor a caption and its tail both or neither.

### Verifying

`node --experimental-strip-types website/scripts/generate-screenshots.ts --check
--filter <spec> --exact --localport <free port>` renders twice and touches no
committed file; `drawAnnotations` throws on an anchor resolving to nothing. Always
pass `--localport`: another run holding the default port shows up as a blank page
and a ready-gate timeout long before `EADDRINUSE`. A clean run does **not** prove
the callout is in the picture, since one that resolves and then draws off-frame is
silent.

Don't regenerate a figure to prove a conversion. A worktree carries other agents'
unlanded display edits; land the spec change and let the weekly sweep render it
on a clean runner.

## An empty capture is the generator's readiness race

**Gate on a data-derived DOM signal.** The color legend exists only once data has
been binned: set `readySelector: '[data-testid="floating-legend"]'`. It uses
puppeteer `waitForSelector({visible:true})`, so `displayPainted('<name>-display')`
fails it: GPU displays paint into a `position:absolute` canvas, so the
DisplayChrome element has height 0. Pick a drawn element.

## A lost WebGL context commits a blank canvas, and the run says nothing

- **A run that logs a context loss is not a run whose figures you may commit.**
  Grep the log for `context LOST` before `figures:push` and re-shoot the specs it
  names ([GPU_PORTABILITY.md](GPU_PORTABILITY.md) §"The WebGL2 context budget").
- **Concurrency is the lever.** The generator runs four specs at once, each a
  browser with its own contexts, so a figure stacking GPU displays loses them
  under a sweep and keeps them alone. Run such a spec on its own.

## Slow figures are SwiftShader, not the app

To regenerate a slow figure use `--headed` (or `xvfb-run`); capture geometry is
unaffected. Don't raise timeouts first. `tcga/cohort_cnv_genome.png` is the only
GPU-rendered committed figure, and switching the default would rewrite every PNG
once.

## Desktop figures

`products/jbrowse-desktop/test/screenshots.ts` drives the packaged Electron app
over selenium and writes `website/static/img/desktop-*.png`
(`pnpm screenshots:headless --only desktop-blat,desktop-ispcr`;
`pnpm screenshots:build` packages first).

**It renders the packaged app, so a code change needs
`pnpm package:linux:no-installer` first.** A stale binary fails with errors from
bugs already fixed in source.

`--only <substring>[,...]` decides which files a run may write; the harness has
no content-stable gate, so it is all that keeps a regen from re-encoding every
other figure. **Bundled data first, network last**: opening a genome after an
hg19 session was torn down hangs the import form with the assembly stuck
`initialized: false` and no error.

- **`desktop-cli-config.png`** runs the real `@jbrowse/cli` (build it first) and
  opens that `config.json`. **It launches through a wrapper script**
  (`createDriver({ launchFile })`), because chromedriver re-emits every
  `chromeOptions.args` entry as a `--` switch. **Build a fresh config every run**:
  Desktop rewrites the opened file as its session file.
- **`waitForAppReady`** (`test/harness.ts`) reads the web generator's signals
  (`products/jbrowse-capture/src/waits.ts`). **They must stay clear for a settle
  window, not read clear once**: a display's fetch autorun is debounced, so right
  after a navigation every signal reads ready and the capture gets a blank canvas.
### Selenium traps

- **The implicit wait dominates a run.** `setTimeouts({ implicit: 30000 })` makes
  every `findElements` that returns nothing cost 30 seconds. Existence checks go
  through `countElements`; keep new waits off `findElements`.
- **Never send a plain `.fa` without a `.fai`.** It becomes `FastaAdapter`, which
  indexes through the `indexFasta` IPC handler, and that step hangs silently. The
  figures send `volvox.2bit`, which needs no index; `openVolvoxGenome` gates on the
  assembly manager.

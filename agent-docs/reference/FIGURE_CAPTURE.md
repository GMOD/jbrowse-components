---
name: figure-capture
description: Why does a committed web or desktop figure disagree with what you meant, and how do you regenerate one? Covers misplaced callouts, readiness races, blank captures, software-rasterized renders, and the selenium harness for the packaged Electron app.
audience: internal
kind: operations
---

# Capturing a figure

Five ways a committed web PNG disagrees with what you meant, all in
`website/scripts/generate-screenshots.ts` and the browser-test suite rather than
the app: a callout resolves somewhere unintended, the capture lands before the
data arrived, the capture path returns something the renderer never drew, every
WebGL draw runs on the CPU, or the app that drew it was built from older source. **A figure that looks wrong is a harness bug
until the render is ruled out.** The desktop figures come from a separate
selenium harness over the packaged Electron app ("Desktop figures").

## Where a callout lands

Never hand-measure a callout position: every annotation `anchor`s, and a click
anchors too. The vocabulary is
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
- **A callout or click on a feature, record or row names it**
  (`{ trackId, feature }`, `{ trackId, row }`, `{ chord: '<label>' }`) rather
  than a `fracY`, which lands on another row once a band is added above it. A
  chord's feature id is parse order and drifts; its label does not.
- Prefer a session `highlights` entry to a callout: its `label` lands in every
  linked view and travels with the figure's live link.
- Put a click that changes state in the session spec, since the figure's recipe
  command clicks nothing; `clicksOpen` / `clicksChange` name the exceptions.

- **A spec anchor that lands on the wrong thing: sweep the coordinate before
  tuning it.** ~20 lines on `website/scripts/probe-app-settled.ts`'s scaffold
  (`createTestServer` + `captureUrl` + capture's `resolveAnchor`), dumping
  `[role="menuitem"]` per step; if no value works the hit test is wrong, not the
  anchor. Read `display.contextMenuHit` (`genomicPos`, the block's `rpcData`): a
  non-integer `genomicPos` beside integer `mismatchPositions` was a `bpAtPx`
  regression.

## Sizing, readiness and staleness

- Size a figure from the run's `CONTENT CLIPPED BELOW THE FOLD` /
  `blank below the last content` report, not off the PNG. Neither sees a display
  overflowing its own fixed height; `heightMode: 'grow'` exposes a pileup's.
- A spec timing out at readiness is slow or broken: raise `readyTimeout` or fix
  the display, never add a sleep. `DISPLAYS NOT PAINTED AT CAPTURE` names a
  frame that may be blank.
- `--cover` proves every type still paints, never that a figure is current.
  After rebuilding hosted data, `python3 website/scripts/report-stale-figures.py`
  lists the figures shot before a file they draw changed.
- **A staleness entry can close without naming a figure**, when a bulk publish
  rewrites `figures.lock` wholesale. Before spending the pipeline on one,
  compare three dates: the entry's last commit, the figure's lock line
  (`git log -1 -S<hash> -- figures.lock`), and its `reviewedAt` in
  `website/scripts/screenshot-review.json`. A re-shoot newer than the entry
  leaves a look, not a capture.
- **A renamed UI string leaves stale figures no grep finds**: a figure shows a
  menu row because its capture left the menu open. Every figure is shot at
  `DEVICE_SCALE_FACTOR` 2 against one stylesheet, so template-match the old
  label: binarise its crop (from a store copy still carrying it) and each
  figure at mid-grey, cross-correlate the ±1 masks (`scipy.signal.fftconvolve`)
  and score at ~97% of the template's pixel count, not 100%, since sub-pixel
  glyph placement moves a few pixels. Sabotage the scanner before believing a
  zero. For tours, grep `website/static/media/**/*.vtt`.
- **Regenerating that figure needs `--filter`**, which is what sets
  `forceCommit`: an unfiltered sweep's 0.5% diff gate is wider than one word in
  a 3000 px figure. A `mode: 'compose'` figure recomposes from its parts, so
  filter on the parts.
- **Recapture after any fix that changes the screen**, and read `git status`
  after a green suite: a golden shot mid-fix keeps the bug as the reference,
  and one a run keeps rewriting no longer matches intent.

### Reading a reshoot

- **Review the PNG the run wrote**, never `website/static/img/` in the primary,
  which holds the last published copy, and never write or check a caption
  against a figure whose Read came back "[media removed]". Fetch the figure it replaced from the
  store by its `figures.lock` hash ([HOSTING.md](HOSTING.md) has the URL
  scheme; `git show <ref>:figures.lock` reaches further back) and read the two
  side by side. On a shared primary install landed figures by hash rather
  than `figures:pull --force`, which discards other sessions' unpushed ones.
- **A run's `updated` list is relative to that run's disk**, not to the store,
  so a figure an earlier run already wrote there drops off it. Build a publish
  list from every name shot and let `figures:push --filter … --exact` skip the
  unchanged bytes.
- **A whole view captured as its title bar over white**, with the model loaded
  and no page error, is usually a flaky capture. Retake once and record
  `page.on('console')` as well as `pageerror`; only a blank that repeats with
  an error is a bug.
- **To prove a setting paints nothing**, capture one spec with and without it
  against one build and compare `sha256sum`s; an identical hash is the whole
  argument. Put each arm in its own session or trackId, since a display config
  slot lives on the shared track config.
- **A `type` step aimed at a MUI Autocomplete by its label text types nowhere**
  and the run reports ✓ over an empty field: the text lookup takes the smallest
  element carrying the text, which takes no focus. Give the input a testid
  through `slotProps.htmlInput` and type by selector (`group-by-attribute` in
  `videos/ui.ts`); `press Escape` folds the suggestion list without closing a
  dialog. A `hover: { text }` on a canvas feature captures a blank canvas the
  same way; anchor it with `track` + `locus`.

- **Judge a reshoot against a baseline shoot, not the published copy.** A
  published figure is as old as its last publish, so a diff against it mixes
  every commit and hosted-data change since. `git worktree add --detach <path>
  <pre-change-sha>`, shoot the same names there (`jb-shoot --get <names>` on
  ada, own `SCRATCH`), pair with `convert … +append`, rank with `compare -metric
  AE -fuzz 5%` (8% for the highlight map; the store PNGs are 256-colour, so zero
  fuzz flags palette re-quantisation). A multi-region pileup's row order can
  differ between two shoots of one build (13.6% on
  `cancer_sv/derivative_synteny`): shoot the baseline twice before blaming a row
  shuffle. A graph pane differing between shoots minutes apart usually means the
  hosted plugin's `latest/` moved. A baseline `--get` including a
  `jbrowse-img/*` spec runs `build:esm` first; if that fails it shoots nothing
  yet still fetches the published copies (log says `pnpm build:esm failed`). A
  hosted-UCSC-hub spec needing hg38 sequence stalls on hgdownload's hg38.2bit;
  put it on a demo config whose sequence jbrowse.org serves (demos/cancer_sv's
  assembly block).
- **`figures.ts status` "modified" is not stale.** `--filter` implies `--force`
  (`screenshot-options.ts`), so every matched PNG is rewritten and listed as
  modified. Copy the published set aside after `figures pull`, shoot, `compare
  -metric AE -fuzz 5% old new null:` per file; under ~30,000 differing pixels on
  a 3000 px figure was antialiasing, real changes run to millions. Publish only
  what moved, `push --exact --filter`. The primary checkout's `static/img` stays
  stale after a worktree publish until a plain `node website/scripts/figures.ts
  pull`, which replaces figures whose bytes are published (pre-push's "figures
  on disk differ from figures.lock"); `--force` also discards figures that exist
  only on disk.

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

- **Before a bulk publish, grep `agent-docs/handoffs/` for each figure name**
  and drop any another session declined; a diff gate says a figure changed, not
  that it is right. When main moved a figure after your base, main's line wins
  in the `figures.lock` merge.
- **A figure red at its ready gate missed every reshoot and fixture bump
  meanwhile** (`maf_hprc_pangenome` missed the HPRC 2.1 move that renumbered
  every rGFA segment). After repairing one, check what landed while it was red,
  especially commits saying "every X reshot".
- **A spec track's `filter` replaces the config's whole list** (`plot.test.ts`,
  "a plot's filter list is written whole"). A spec adding one jexl rule to a
  `geneLike` track drew the hg19 RefSeq region features for a month; write the
  config's entries too (`['geneLike', "jexl:…"]`, as
  `website/scripts/specs/ui.ts` now does). Nothing compares a spec's filter with
  its track's.

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
once. A spec dying on data volume says something about SwiftShader, not the
product, and stays out of captions.

## A build older than the checkout draws the old app

`build/` is replaced in place, so a build from last week looks exactly like one
from this minute. Before it compiles, the build snapshots the app sources on
disk as a git tree, uncommitted and untracked files included
(`products/jbrowse-web/scripts/sourceSnapshot.ts`), and stamps it into
`build/build-info.json`. The generator diffs that tree against a fresh snapshot
before it captures anything, and prints `FIGURES CAPTURED AGAINST A STALE APP
BUILD` with the files that differ.

- Committing the edits a build compiled leaves it current; discarding them
  makes it stale.
- The snapshot uses a scratch index, so it never touches the checkout's index
  or the shared stash list.

- The run rebuilds a stale local build before capturing; `--allow-stale` skips
  that. An app behind `--port` cannot be rebuilt from here, so the run reports
  it and keeps going, and `--strict-build` stops it instead.
- The loud version of the bug fails the spec: a build from 2026-10-20 answered
  a session written against the renamed alignments `sort` key with
  "AlignmentsSort takes type, pos, refName, tag and within, not field". The
  quiet version draws the old behavior and commits it.
- `--port <n>` proxies to a server this run did not start, so the report is
  `NO BUILD PROVENANCE` unless that server serves a stamped build. A
  `pnpm start` dev server serves the current source and needs no rebuild; one
  started from another checkout reports `DEV SERVER FROM ANOTHER CHECKOUT`.
- An edit under `products/jbrowse-web/test_data` leaves the build current: the
  capture server serves test_data from the checkout, not from `build/`.

- **A `website/scripts/probe-*.ts` or ad-hoc puppeteer script checks no build
  staleness**, unlike the generator. It draws whatever its URL serves: some
  probes (`probe-rows.ts`) open the hosted build, others a local
  `products/jbrowse-web/build`, which needs `pnpm --filter @jbrowse/web build`
  (~7 min) after a source change; a `pnpm start` dev server needs none. A
  changed default or threshold renders a plausible old picture and nothing
  errors. If a sweep ran stale anyway, `node website/scripts/figures.ts pull
  --force` restores the corpus from `figures.lock` (never in a primary checkout
  others share: it discards their unpublished figures).
- **Graph figures render the hosted plugin, not the checkout.** They load
  `jbrowse.org/plugins/jbrowse-plugin-graphgenomeviewer/latest/`, and `pnpm
  check-live-configs` refuses any other URL; a release reaches `latest/` only
  through the store step, so check the hosted `latest/package.json` before
  calling a fix unreleased. A store step that moves the graph plugin stales ~40
  figures at once with nothing reporting it: sweep the figures whose session
  holds `GraphGenomeView` (`liveLinks.generated.ts`) intersected with
  `figures.lock`.

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
`initialized: false` and no error. The same report came from the run's first
volvox open in 3 of 5 runs under load ~24 (2026-11-03), with MST dead-node
warnings at `/assemblyManager/assemblies/0` and a failure screenshot showing
volvox loaded, so the harness was reading a replaced root; 7 runs passed once
the load fell. `openVolvoxGenome` logs whether `window.JBrowseRootModel` and
`window.JBrowseSession` are alive and agree when it fails.

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
- **`sendKeys` appends to what the app already put in a field.** `UrlChooser`
  is uncontrolled, so once add-track filled a sibling index itself the typed
  URL concatenated onto it and the track 404'd every run. `clearInput` first,
  or stop typing what the app now fills. An input the app swaps as soon as the
  text classifies can unmount mid-word (`AddGenomePane` once cut `.fa.gz` to
  `.fa`).
- **In puppeteer, a triple-click does not replace a controlled MUI
  `TextField`'s value**: the re-render drops the selection and the next key
  inserts mid-string. Click, press End, then Backspace per character.
- A track that cannot load says so in the view and nowhere else;
  `assertNoErrorBanners` (`test/harness.ts`) is the backstop, and a doubled URL
  in a 404 is the tell.

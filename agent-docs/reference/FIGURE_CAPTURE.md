---
name: figure-capture
description: The four ways a committed figure disagrees with what you meant — a callout that landed somewhere else, an empty capture from the generator's readiness race, a blank or chrome-banded one from el.screenshot()'s own capture path, and a render that takes minutes because it is software-rasterized. One harness, and in every case the app was not the thing that was wrong. Read before placing a callout, diagnosing an "empty painting" as a data bug, or "optimizing" a slow figure.
audience: internal
---

# Capturing a figure

Four ways a committed PNG disagrees with what you meant, all of them
`website/scripts/generate-screenshots.ts` and the browser-test suite rather than
the app: a callout resolves somewhere you did not intend, the capture lands on a
frame the data had not reached, the capture path hands back something the
renderer never drew, or the whole thing takes three minutes because every WebGL
draw is running on the CPU.

The common lesson across all four is the one that keeps being paid for twice:
**a figure that looks wrong is a harness bug until the render is ruled out**,
and each section below records the reading that ruled it out — a legend that
only exists once data arrived, `toDataURL` against `el.screenshot()`, the
element rect read after the capture rather than before, a Chrome task trace
against a JS profile.

## Where a callout lands

`website/CLAUDE.md` states the rule: **never hand-measure a callout position —
every annotation `anchor`s, and a click anchors too.** This is the how, and the
arithmetic you would otherwise re-derive with a render.

The vocabulary is `AnnotationAnchor` in
`packages/browser-test-utils/src/annotationOverlay.ts`, shared with the desktop
selenium harness. Four kinds, in decreasing order of preference: `track`+`locus`
(the live LGV model), `graphNode` (a GFA segment), `selector`, `text`. Actions
take the same shape through `website/scripts/locusAnchor.ts`, whose header is
the writeup of what a stale coordinate cost — `alignments_sort_by_base` kept a
108bp-era right-click after its spec narrowed to 31bp and read as 17% render
flakiness for months.

`website/scripts/check-specs.ts` ratchets the count of what is left. The residue is
deliberate; its comment says which kinds and why.

### What the types don't say

Four things, all of which produce a plausible-looking figure rather than an
error:

- **The anchor's `dx`/`dy` and the annotation's own `dx`/`dy` both apply, at
  different stages.** The anchor's shifts the resolved rect *before* `alignX` /
  `alignY` are read off it; the annotation's shifts the point afterwards. For a
  point anchor they are equivalent, which is why the difference goes unnoticed
  until an `alignX: 'right'` is involved.
- **A `fromAnchor` is read exactly like an `anchor`**, `alignX`/`alignY`
  included, so an arrow's two ends align the same way and a tail can sit at an
  element's edge. It did NOT used to: align was applied to the head and dropped
  on the tail, which put the tail at the rect's centre while the spec said edge.
  Silent in every case and loudest on a wide rect —
  `tcga/mutations_cdh1_histology` asked for a short vertical arrow at a track's
  left edge and drew a diagonal across the whole panel, half a view width off.
  A tail leaving one of our own text pills is still not this: use `leader`.
  Note the anchor's own `dx`/`dy` shift the rect *before* the align is read off
  it, at both ends, so a spec that encodes half an element's width as a `dx`
  (what this used to advise) must drop that `dx` when it adopts an align.
- **A `box` whose anchor sets `fracY` gets a zero-height band**, so `height`
  falls back to `2 * pad` (12px). Supply `height` explicitly. Omitting `fracY`
  instead wraps the whole track band — right for a short track, wrong for a
  130px display holding a 10px glyph.
- **`pad` insets a box on every side** (default 6), and `width`/`height` given
  explicitly are used verbatim while `x`/`y` still get the `pad`. Frames that
  have to meet a row exactly, or meet each other at a breakpoint, want `pad: 0`.

### A label that points at something is ONE annotation

`leader: true` on a `text` annotation draws the label's arrow with it. The
anchor is then what the callout NAMES, and the annotation's own `dx`/`dy` place
the label off it: `dx`'s sign picks the side, its magnitude is the gap between
the target and the pill's facing edge, and `dy` centres the pill on that line.
The tail comes off the measured pill, so nothing about it is written down.

Two annotations cannot do this, and the reason is not fixable by better
numbers. A tail belongs at the pill's edge; a pill's width is only known once
its text is measured in the page; so a spec can only guess it, and one guess
fits one label length. `dog10k-size-fst-scan-genome` named three peaks with one
pair of offsets and got three different gaps — IGF1's arrow stopped 50px short
of its pill and IGF2BP2's tail vanished inside one — while `ld/lct_fst_scan`'s
three-letter label floated on its own. Both came back from review as "the
arrows are no longer next to the text boxes". `oat_homoeologs` was the same
defect a third time, found by counting the pattern rather than by a reviewer.

A `leader` whose pill covers its own target draws no arrow and reports a miss,
so the fix (raise `dx`) surfaces as a thrown error rather than as a figure with
a label and no arrow in it.

**`countDetachableLabels` ratchets the rest** (`screenshot-spec-rules.ts`,
run by `check-specs`), pairing a `text` with an `arrow` whose `fromAnchor`
resolves to the same site. That is authorship rather than proximity, so it
cannot fire on an arrow that legitimately starts in open space. Converting one
moves pixels, so they land as their figures are touched; lower `LEADER_BASELINE`
when one does.

Only the SIDEWAYS ones are fragile, which is worth knowing before spending a
regen on a figure that reads fine. Horizontal is the axis whose extent only the
page knows, so a pill whose arrow leaves through a horizontal edge — every one
of `lgv_usage_guide`'s toolbar callouts — sits where it was put. The sideways
ones that look right today are right by coincidence, and go wrong on the next
edit to a label or a font size.

One trick worth reusing: `parseAnnotationLocus` accepts `..` as well as `-`, so
a location string printed by the UI (`chr10:122,835,344..122,837,142`) works
**both** as a `text` anchor finding that cell in the DOM and as a `locus`
resolving to the feature's pixels. `sv_cgiab/deletion_sv_inspector_search`
collapses five callouts onto one constant that way, and the callout on the row
and the callout on the glyph then cannot drift apart.

### Converting a hand-placed coordinate without rendering

Rendering to see what happened is slow, and on a shared box a render bakes in
whatever another agent last built. Everything below comes off the committed PNG.

**Halve everything.** Captures are `deviceScaleFactor: 2`. A `stageColumns`
grid also gives each panel a 12px white border (`GRID_GUTTER_PX / 2`) in
captured pixels, so a stage's own (0,0) is at composed pixel (12,12); vertical
stacks abut with no border.

**x is a locus, and the mapping is exact.** The LGV's tracks container spans the
capture width with its left edge at 0, so `locus = windowStart + x *
(windowBp / viewportWidth)`. Verified three ways: `multisv`'s inversion band
edges, `maf_codon_tooltip`'s tooltip printing the codon its hover landed on
(`chrI:2,999,247`, from x=351 in a 1250px capture), and `linear_align_ctx_menu`'s
ruler ticks.

**y is a depth into a track, and the track's top is findable.** Track labels are
**in flow by default** — `LinearGenomeViewPlugin`'s `trackLabels` slot defaults
to `offset`, and `TrackContainer`'s `trackLabelOffset` adds `marginBottom: 4` —
so the label chip pushes the content down and the rendering container starts at
the chip's bottom edge plus 4. In a default 1500px-wide capture that puts the
**first track's rendering container at y = 193**, which four unrelated figures
agree on. Cross-check it against the display: an alignments track's coverage
band is exactly `coverageHeight` (45 by default) from the container top to the
first read row.

Prefer `fracY: 0` plus a `dy` over a bare fraction whenever the display packs
from its top (a pileup, a feature layout): 57px is the second read row whatever
height the display is given, where a fraction is that row at one height only.
Use a fraction when the rows genuinely divide the height (the trio VCF's six
haplotype rows) or when the callout should stay proportional.

**A committed figure already records what its anchors resolved to.** Two
readings, both exact:

- An **anchored arrowhead's tip is its element's centre**, because the marker is
  placed base-first at the shortened line end and extends `ARROW_LEN *
  strokeWidth` forward to the target. Ray-cast out of the known raw tail, keep
  the longest run of callout red (`#e3242b`), and the far end is the anchor
  point. That is how `lgv_usage_guide`'s six toolbar controls were placed — all
  five in the toolbar tier came back at y=121.4, which is its own proof the
  reading is sound.
- A **`box` annotation's painted rectangle is its element's rect**, inset by
  `pad + strokeWidth/2` on each side. The inset is symmetric, so the box's
  centre *is* the element's centre with no arithmetic at all.

**Then draw the predicted geometry over the committed PNG and look at it.** Ten
lines of PIL. Catches an off-by-a-row before it costs a render.

### When not to anchor

Two cases, and converting them to satisfy a count makes the figure worse:

- **A caption parked in a corner or a margin.** It points at nothing, so the
  failure anchoring prevents — a callout landing off its target — cannot happen
  to it, and anchoring *relocates* it: `sv_cgiab/translocation_sv_inspector_view`
  puts its caption at (60,90) while the `SV_20` row it names is most of a view
  further down. If one is worth touching it is because it collides with content,
  and that is a composition fix.
- **The tail of an arrow leaving one of those captions.** The caption and its
  tail are one unit in page coordinates. Anchoring only the tail pulls the arrow
  off the pill it leaves the first time a layout moves, which is worse than
  either end being raw. Both or neither — and "both" means anchoring the pill to
  the panel it sits over, the way `inverted_duplication`'s three callouts hang
  off their pileup track's top edge. Where the whole callout can anchor to what
  it names, `leader` makes the question moot.

### Verifying

`node --experimental-strip-types website/scripts/generate-screenshots.ts --check
--filter <spec> --exact --localport 3355`, which renders twice and touches no
committed file. `drawAnnotations` throws on any anchor that resolves to nothing
and an action anchor fails the spec by name, so a clean run *is* the proof every
anchor resolved; the percentage is the run-to-run drift.

**Pass `--localport`** — another agent's run holds the default 3334, and the
collision surfaces as a blank page and a ready-gate timeout long before it
surfaces as `EADDRINUSE`.

**A clean run does NOT prove the callout is in the picture.** `drawAnnotations`
only reports an anchor that resolved to *nothing*; one that resolves and then
draws off-frame is silent. `pangenome/rgfa_hover_sync` carried the pill that
answered its review note for a whole round, anchored `dy: +90` off a node the
force layout puts at the foot of a 1250px capture — so it painted at y≈1299 and
no reviewer ever saw it. When a callout hangs off content whose position the
layout chooses, check the drawn y against the capture height rather than
trusting the run.

Don't regenerate the figure to prove the conversion. The worktree usually
carries another agent's in-flight display edits and `products/jbrowse-web`'s
build output is whatever they last built; a figure rendered under that bakes their unlanded
work into a committed PNG. Land the spec change and let the weekly sweep render
it on a clean runner.

## An empty capture is the generator's readiness race

A canvas/GPU display's figure occasionally captures **empty** (no features), even
though the same spec renders fine on the dev server and on clean re-runs. This is
a **screenshot-generator capture race**, not a data/adapter/refName bug, and it
is written down so the next "empty painting" report doesn't get mis-diagnosed as
an adapter problem.

### The concrete case (trio-ancestry)

`trio-ancestry` (a `LinearMultiRowFeatureDisplay` painting an ASW trio's six
haplotypes by local ancestry) rendered empty in the committed PNG. It was
reported — twice — as a data bug: first "BedTabix partition column not read",
then "refName aliasing broken". **Both were wrong.**

What was actually true:

- refName aliasing works. The hosted BED uses `chr1`; the hg38 assembly's
  canonical refName is `1`; the rename (`RpcMethodTypeWithRenameRegion` →
  `getRefNameMapForAdapter` → nested `CoreGetRefNames`) maps `1`→`chr1`
  correctly. Verified end to end.
- The BedTabix `sample`/`ancestry` extra columns parse fine (`defaultParser`
  zips `columnNames` to values; `feature.get('sample')` returns the row label).
- On the dev server the painting renders every time.

The empty capture was **intermittent** — the exact same spec rendered a full
6-row painting on clean sequential re-runs, and captured empty when the machine
was under load (concurrent builds).

### Why it happens

The generator's readiness waits (`waitForLoadingComplete`, `waitForDisplaysDone`)
key off the display's own "ready" signals — the loading overlay clearing and the
`<testid>-done` suffix, both driven by `canvasDrawn`. **`canvasDrawn` can flip on
an empty first paint**, before the feature data has been fetched and drawn. Under
a slow first fetch (the first RPC on a session lazily boots the web worker; a
heavy config or a loaded machine makes that boot slow), the display briefly reads
as "ready" with nothing painted, and a fixed `settleMs` can elapse inside that
window — so the capture lands on an empty frame. `waitForDisplaysDone` also
swallows its own timeout, so a genuinely-never-finished render commits empty
rather than failing loudly.

Two red flags this matches (both already called out in
`website/CLAUDE.md`): a capture gated on a **fixed `settleMs`**, and a `readyText`
that matches the **track name** (present immediately) rather than the rendered
content.

### The fix pattern: gate on a data-derived DOM signal

Wait on something in the DOM that can only exist **after the feature data has
loaded and been processed** — not on `canvasDrawn`/settle. The color legend is
ideal: it renders one entry per binned value, so it is absent until real data
arrives.

- `SvgColorLegend` (`packages/core/src/ui`) takes an optional `testid` prop,
  applied to its outer `<g>` — which only renders when there are entries.
- `MultiRowColorLegend` passes `testid="multirow-color-legend"`.
- The spec sets `readySelector: '[data-testid="multirow-color-legend"]'`.

Result: content-stable (0.000% diff across runs), always the full painting; and
if data genuinely never loads, the wait times out and the spec **fails loudly**
instead of committing an empty PNG.

#### Gotcha: the chrome element is 0-height

The obvious signal, `displayPainted('<name>-display')`, does **not** work
through a `readySelector` (which uses puppeteer `waitForSelector({visible:true})`):
the GPU displays paint into a `position:absolute` canvas, so the DisplayChrome
element collapses to **height 0** and never passes the visibility check (it
`EXISTS` but is not `VISIBLE`). The generator's own `waitForDisplaysDone` gets
away with it because it queries by **existence** (`querySelectorAll`, now on
`[data-display-drawn="false"]`), not visibility — but it's an early (`canvasDrawn`) signal
and swallows timeouts, so it isn't a reliable capture gate on its own. Pick a
data-derived, actually-drawn element (legend, a rendered label) for
`readySelector`.

Note that `settleMs` is purely the **timeout** on that wait, never a floor: a
page whose displays are all painted (or that has no canvas display at all —
a menu, widget, or import-form figure) proceeds immediately. It used to burn the
full duration whenever no wrapper matched, which made it read like a fixed
sleep and invited tuning it as one.


## The other blank capture: `el.screenshot()` vs the compositor

The section above is the **website generator's** race, and its fix is a better
readiness wait. The browser-test suite
(`products/jbrowse-web/browser-tests`) has a second, unrelated one that no wait
can fix, and the two get confused because the symptom is identical.

There, a capture came back blank while **every** app-level signal was legitimately
true — loading overlay down, no display in its `loading` phase, every display
reporting `canvasDrawn`, morph idle. Measured 34 of 34 blanks that way, on both
the canvas2d and webgl backends, so it is neither a GPU-driver story nor a
slowness one. `preserveDrawingBuffer` and a compositor double-rAF were both
tested and neither helped (see the handoff for the tables).

The question was settled by asking the canvas instead of arguing about it.
`el.screenshot()` goes through Chrome's capture path, which serves **composited
layers**; `canvas.toDataURL()` reads the **backing store** and never touches the
compositor. So on a blank capture the two answers separate the causes, and one
occurrence decides it:

```
[self-report: canvas 1193x529 HAS content (19442b) while the screenshot is blank
              -> capture/compositing side]
[self-report: canvas 1268x100 is ALSO blank -> render side]
```

Both verdicts have now been observed. The first is the one that matters: the app
had drawn, and the capture path handed back an empty image.

### Those bytes diagnose the blank. They are not a substitute capture.

The obvious next step — use the `toDataURL` bytes as the capture, since they are
demonstrably the render — was implemented, measured, and reverted the same day.
A recovered `targeted_variants-assembly-aliases` came back **93.65% different**
from the other backend's screenshot of the same view, and the diff image showed
every glyph landing in an identical place over a wholly different background:

- `toDataURL` returns the canvas's own pixels with **alpha unflattened**;
  `el.screenshot()` returns the element box **composited** over what is behind it.
- `el.screenshot()` also captures any DOM drawn over the canvas, and the selector
  can name a wrapper holding more than one canvas. `toDataURL` sees neither.

The drawings agree; the capture paths do not. A differential oracle that compares
one backend's backing store against another's composited layers is comparing
capture paths, not renderers — and a false 93% drift is much worse for a blocking
gate than a re-run. So a blank capture fails its test, and the CI gate's
fresh-browser retry takes it again through the same path on both sides.

`assertCanvasHasContent` is the one place the backing store *is* authoritative:
it asks "did this display draw" and compares no bytes against anything.

Two further limits:

- **A "render side" verdict on webgl is not conclusive** — a cleared drawing
  buffer reads identically. On canvas2d it is conclusive.
- **None of this masks a shader that draws nothing.** That canvas self-reports
  blank too, and still fails with the render-side verdict.

## The third one: `el.screenshot()` scrolls the element first

Not a blank, and not a race. The capture is full, stable, byte-reproducible, and
**wrong in a band at the top**, because puppeteer scrolls the element into view
before capturing and the browsers disagree about whether to scroll.

Found on the alignments suites' canvas2d-vs-webgpu pairs, which are also a
Chrome-vs-Firefox pair, since WebGPU needs Firefox Nightly. Eight stable
over-threshold pairs, 3-4% on the targeted captures and 16-27% on the fullpage
ones, holding to the decimal across runs. Measured with
`browser-tests/probe-webgpu-coverage.ts`, which prints both capture paths side
by side and had to be repaired first: `b7f076fe04` swept a node-side selector
helper into a `page.evaluate` body, so every run of it between that commit and
2026-08-26 threw `displayPainted is not defined` on its first read.

| | Chrome (canvas2d, webgl) | Firefox (webgpu) |
| --- | --- | --- |
| canvas rect before capture | top 197 | top 197 |
| canvas rect **after** capture | top 197 | **top 124** |
| `window.scrollY` after | 0 | 0 |
| painted over the canvas after | nothing, rows 0-38 | locstring box 12px, untagged toolbar divs 8px, ruler 17px |

Firefox moves the element up 73px with `window.scrollY` still 0, so an inner
scroller moved. The canvas top then sits under the app's header, and
`el.screenshot()` composites that header into the element's rectangle:
12 + 8 + 17 = **37px**, which is exactly the band that differs. Everything below
it is pixel-identical between the backends.

The three things worth carrying:

- **The render was never wrong.** The backing store held the full coverage strip
  the whole time, which is the conclusive direction of the `toDataURL` check
  above.
- **It is not an offset.** Sliding the capture over the viewport screenshot
  matches at offset **0** (0.02% residual, against 29-34% at every other offset
  tried). The clip rectangle is right. The page really does paint chrome there.
- **A `[data-testid]` scan is not enough to attribute it.** It found only the
  12px of locstring box, because the toolbar's layout divs carry no testid.
  `document.elementsFromPoint` down the band, *after* the capture, names all 37
  rows. Read the geometry after the screenshot, not before: the scroll that
  causes this happens inside the call.

The apparent correlations are all downstream of the scroll, and each would have
sent an investigation somewhere useless: it looked like a coverage-strip
rendering bug (the band is where the coverage strip is), like a zoom-dependent
one (a zoomed-in locus stacks more pileup rows, so the display is taller and
Firefox decides a scroll is needed), and like a WebGPU one (only that backend
runs in Firefox). The band is fixed at 37px whether `coverageHeight` is 45 or
90, which is what rules the first one out.

### Fixed 2026-08-26: the capture clips where the element already is

`captureElementPng` in `browser-tests/snapshot.ts` is the one path every element
capture in the suite now takes. It reads the rect through the **selector**, calls
`page.screenshot({ clip })`, reads the rect again and throws if it moved — which
is all `el.screenshot()` does apart from the scroll it is being avoided for. A
threshold override was never the answer: it would have excused a harness artifact
as a rendering difference.

Measured on the two alignments suites, `--backend=all --swiftshader --gate-only
--drift-report`, same build either side of the change:

| pair (canvas2d vs webgpu) | before | after |
| --- | --- | --- |
| `fullpage_color-by-strand` | 27.01% | 0.48% |
| `fullpage_color-by-tag-hp` | 24.21% | 0.49% |
| `fullpage_color-by-mapping-quality` | 23.13% | 0.48% |
| `fullpage_alignments-bam` | 15.01% | 0.91% |
| `targeted_color-by-strand` | 3.88% | 0.08% |
| `targeted_color-by-mapping-quality` | 3.88% | 0.07% |
| `targeted_color-by-tag-hp` | 3.51% | 0.01% |
| `targeted_alignments-bam` | 3.47% | 0.01% |

40 pairs, 8 over threshold before and **0 after**, max 0.91%, median 0.08%. The
control that makes it a fix rather than a coincidence: every canvas2d-vs-webgl
figure in the same two runs is unchanged to the decimal (0.70 / 0.62 / 0.23 /
0.21 / 0.14 / 0.07), because Chrome was never scrolling and its captures did not
move.

Three things the fix turned up that the attribution above did not predict:

- **Assert the rect through the selector, not through an element handle.** A
  pileup display swaps its canvas element during the capture on *every* run —
  `isConnected` reads false afterwards while `document.querySelector` still finds
  one canvas at the same `1266x600@6,197`. `el.boundingBox()` answers `null` for
  a page that never moved, so the first spelling of this invariant failed 100% of
  the time on the suite it was written for.
- **The scroll was carrying a compositor barrier.** `scrollIntoViewIfNeeded`
  awaits an `IntersectionObserver`, whose callback the spec queues inside
  update-the-rendering, so puppeteer had always produced a frame before
  capturing. Removing the scroll removed that, and blank captures went *up*.
  `browser-tests/probe-capture-barrier.ts` measures the three paths on one
  settled canvas2d page:

  | capture path | N=15 | N=25 |
  | --- | --- | --- |
  | `el.screenshot` (puppeteer's own barrier) | 3/15 blank | 0/25 blank |
  | clip, no barrier | 5/15 blank | 6/25 blank |
  | clip, `IntersectionObserver` barrier | **0/15** | **0/25** |

  So the barrier is now explicit, and better placed than the one it replaces:
  puppeteer's ran before the scroll decision with a round trip after it, and this
  one is the last thing before the clip. That is a lead on the blank captures in
  the section above, which no amount of *app-level* waiting could fix.
- **`scrollIntoView: false` works at runtime and does not typecheck.** Puppeteer
  25 declares it only on `screenshot`'s implementation signature; both public
  overloads take a plain `ScreenshotOptions`. Passing it needs a cast that would
  go stale silently, which is why the clip is computed here instead.

## Slow figures are SwiftShader, not the app

The tcga specs took 190-230s each to become ready. **None of that was app code.**
`--use-angle=gl` (or `--headed`, which uses the real GPU) renders the same figure
in **14.1s** — ~15x faster — and `--check` then reports **0.000%** drift between
two renders where software raster needed `diffThreshold: 0.02`.

`generate-screenshots` launches Chrome with `--enable-unsafe-swiftshader`, so
every WebGL draw is rasterized on the CPU. For a figure with 1104 rows and 379k
features across 23 regions at 1900px/dSF2, one draw takes seconds.

### The measurements (2026-07-25, `tcga/cohort_cnv_genome`)

Everything JS-visible is small:

| | measured |
| --- | --- |
| worker JS CPU | 17.6s |
| main-thread JS CPU | 2.2s |
| network | 2.1s (18 requests, 5.8MB; whole file downloads in 0.7s) |
| `postMessage` (structured clone) | 0.15s / 406 calls |
| `checkStopToken` sync-XHR probes | 0.3s / 143 probes (~2ms each) |
| `@gmod/hclust` clustering | 0.4s |
| GC | ~1s |
| **accounted** | **~36s of ~200s** |

Chrome `Tracing` found the rest:

| thread | toplevel busy | tasks | longest |
| --- | --- | --- | --- |
| `CrRendererMain` | 181.2s | 4579 | 26,015ms |
| `CrGpuMain` | 179.4s | 537 | 26,010ms |
| `DedicatedWorker thread` | 0.4s | 1178 | 114ms |

~10 renderer tasks of 3.6-26s, **each mirrored to the millisecond by a GPU-process
task** — the renderer blocking synchronously on software rasterization.

### Methodology: "idle" in a JS profile means look outside JS

A sampling JS profiler only sees JS. Both threads reported ~99% idle because the
cost was in the GPU process with the renderer blocked in a sync IPC wait. Four
plausible JS-level explanations were each measured and **refuted** before the
right tool was used:

- stop-token sync-XHR fallback (`checkStopToken`) — 0.3s, and forcing the
  `SharedArrayBuffer` path changed nothing (cancellation now travels by posted
  message; the sync probe remains, throttled, for loops that never yield)
- structured clone of `featureNames` / `featureIds` (the two non-transferable
  string arrays in `packMultiRowFeatures`) — `postMessage` totals 0.15s
- Chrome background/timer throttling and IPC flood protection — the anti-throttling
  flags made no difference (185s vs 190-210s)
- RPC serialization — 24 calls are dispatched in one tick and RPC is in flight for
  96% of the wall clock, with only ~3s between calls

**When wall clock >> JS CPU on every thread, stop forming JS hypotheses.** Go to
`website/scripts/trace-tasks.ts`; a renderer task mirrored by a GPU task is
blocked-on-GPU.

### Tools (all added 2026-07-25, `website/scripts/`)

- `profile-spec.ts <spec>` — CPU-profiles any spec's cold load, main thread and
  every RPC worker, with a milestone timeline (domcontentloaded → view
  initialized → fetch+parse done → painted → readySelector) and per-file network
  attribution. `--angle-gl` renders on the GPU, `--sab` force-enables
  SharedArrayBuffer.
- `trace-rpc.ts <spec>` — wraps `Worker.postMessage` and the reply channel in the
  page (no app changes, runs the built bundle) for per-method RPC call counts and
  durations, plus worker-side accounting of sync XHR, `fetch`, `postMessage` and
  **event-loop lag**. A dead heartbeat means the thread is blocked, not idle.
- `trace-tasks.ts <spec>` — Chrome-level task trace: which thread ran what, and
  the biggest slices. The tool of last resort, and the one that answered this.

### Regenerating a slow figure

Use `--headed` on a machine with a display (`xvfb-run` works too). Capture
geometry is unaffected: `setViewport` sets emulated device metrics and the CDP
screenshot uses those, so dSF 2 still yields the same pixel dimensions no matter
the window size. Don't reach for bigger timeouts first — that treats software
raster as a fact of life.

### Still open

- **~10 full-canvas GPU passes per figure**, one per arriving RPC reply, each
  re-rasterizing all 1104 rows. Real app-side waste for large multi-region views,
  independent of which rasterizer runs it; `trace-tasks.ts` measures it. Batching
  the per-region replies (or debouncing the instance-buffer rebuild until the
  region set settles) is the fix.
- **Whether hardware GL should be the default.** No CI job runs
  `generate-screenshots`, so figures are only regenerated locally — low risk for
  CI, but the appearance differs from SwiftShader (27.8% on the cohort figure), so
  the switch rewrites every committed PNG once and diverges between maintainer
  machines with and without a GPU. `tcga/cohort_cnv_genome.png` is currently the
  only GPU-rendered figure. A per-spec `hardwareGl?: true` opt-in is the
  lower-risk shape.
- **`tcga/cnv_recurrence_genome` at viewportHeight > 860** still dies with "frame
  got detached". Unexamined since this investigation; now suspect the same
  software-raster path (a taller canvas for the same 1104 auto-fit rows), which
  would make it a harness artifact rather than a renderer bug.
- The spec comment claiming clustering costs "three minutes of RPC" was wrong
  (0.4s) and has been corrected; `screenshot-review.json`'s note on
  `cnv_recurrence_genome` still blames the blank frame solely on the height crash,
  when a cold-assembly race was a second, independent cause (fixed by
  `data-view-phase`, see `waitForViewPhases`).

## Debugging tips that saved time here

- `page.on('console')` **does** forward web-worker console in current puppeteer,
  but the generator filters it; when in doubt, attach a CDP
  `Target.setAutoAttach` session and read `Runtime.consoleAPICalled` to see the
  main/worker boundary. That's what proved the worker was the slow step and the
  render itself was correct.
- The RPC worker boots lazily on the first call and the boot needs the main
  thread to answer its `readyForConfig` postMessage; a saturated main thread (big
  config parse) delays the boot, which is what stretches the "ready-but-empty"
  window. Adding `console.error` instrumentation changed the timing enough to
  hide the race — beware Heisenbugs here.
- Reproduce reliability with N forced runs and watch the content-stable diff
  percentage; a figure that flips between two states shows up as an occasional
  large `% diff` on `--force` re-render.

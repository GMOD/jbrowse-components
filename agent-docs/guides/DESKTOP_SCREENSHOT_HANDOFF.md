# Desktop screenshot harness — open work (2026-07-26)

`products/jbrowse-desktop/test/screenshots.ts` drives the packaged Electron app
over selenium and writes into `website/static/img/desktop-*.png`. It has no
content-stable gate, so `--only <substring>` decides which files a run is
allowed to write.

```bash
cd products/jbrowse-desktop
pnpm screenshots:headless --only desktop-blat-results   # needs dist/unpacked/... built
```

## The task that is not finished

`desktop-blat-results` is flagged `bad` in `website/scripts/screenshot-review.json`:
"might benefit from plotting just longestCoding gene glyph". The hg19 RefSeq
lane draws every transcript, and at the 205 bp the BLAT hit frames that is a
stack of near-identical models.

`collapseGeneGlyph()` in `screenshots.ts` implements it — track menu → **Gene
glyph** → **Longest coding transcript**, by `data-testid`, run just before the
capture. **It works**: a run produced the figure with a single labeled TP53
model and the "Longest isoform" chip. It is not committed because the same run
captured at the wrong size, and the fixes for that are unverified (below). The
committed PNG is still the old all-transcripts one.

## Two harness bugs found while trying to land it

**Window size came from the developer's own app state.** `createMainWindow`
sizes itself via `windowStateKeeper`, which persists into the userData dir —
the same one a developer's real JBrowse Desktop writes. On a machine where the
app was last left 845 px wide, every figure captured 845 px wide next to
committed ones at 1400. Fixed by passing a fresh `--user-data-dir` (mkdtemp) per
run, so windowStateKeeper falls back to the electron defaults (1400x800). This
is verified: `window-state.json` in the temp profile reads 1400x800.

Selenium cannot fix it after the fact — electron's chromedriver has no
`Browser.getWindowForTarget`, so `driver.manage().window().setRect()` throws
`UnknownCommandError`.

**The virtual screen was smaller than the window.** `xvfb-run` defaults to
1280x1024, and a 1400-wide window on it captured 845x763. `screenshots:headless`
now passes `-s "-screen 0 1920x1200x24"`; a probe run of `desktop-landing` on
that screen captured the intended 1400x763.

## What is flaky and needs diagnosing first

Runs die partway with `NoSuchSessionError: session deleted as the browser has
closed the connection` / `target frame detached` — the Electron app itself
disappears, usually while the BLAT search dialog is open. Observed on the
1920x1200 screen run and on a swiftshader run; a 1280x1024 run with GPU flags
unchanged got all the way through. It is not obviously caused by any one of the
three changes, so treat it as pre-existing flakiness to reproduce and bisect,
not as a consequence of them.

Whoever picks this up: confirm one clean `--only desktop-blat-results` run at
1400x763 with the collapsed glyph, commit the PNG, and flip the review verdict.

## Headless desktop figures render on Canvas2D, not the GPU

`createDriver` passes `--disable-gpu --disable-software-rasterizer`, so WebGPU
and WebGL2 are both off and the app logs "No compatible GPU adapter available"
then "WebGL2 unavailable, falling back to Canvas2D". Every headless desktop
figure is therefore captured through the fallback backend rather than the one a
real user renders on. The web screenshot generator instead passes
`--use-gl=swiftshader --enable-unsafe-swiftshader` and gets WebGL2. Swapping the
flags here was tried; that run crashed (see above), so the swap is untested
rather than ruled out.

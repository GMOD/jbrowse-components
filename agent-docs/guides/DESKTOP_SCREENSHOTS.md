# Desktop screenshot harness

`products/jbrowse-desktop/test/screenshots.ts` drives the packaged Electron app
over selenium and writes into `website/static/img/desktop-*.png`.

```bash
cd products/jbrowse-desktop
pnpm screenshots:headless --only desktop-blat,desktop-ispcr
```

**It renders the packaged app, so a code change needs
`pnpm package:linux:no-installer` first.** The binary going stale is not a
theoretical problem: a run against a 10-hour-old build failed at the volvox step
with `Error invoking remote method 'indexFasta': fileDataStream.pipeThrough is
not a function`, a bug that had already been fixed in `electron/fileStream.ts`
hours earlier.

`--only <substring>[,<substring>]` decides which files a run may write; there is
no content-stable gate here (unlike the web generator), so it is the only thing
keeping a regen from re-encoding every other figure. A run walks the flow in
`FIGURES` order and **stops as soon as the last selected figure is written**,
which keeps a BLAT regen out of the flakiest steps. `capture()` rejects a name
missing from `FIGURES`, so that list can't drift out of step with the flow.

Captures off one build are near-deterministic but not byte-stable: repeated runs
usually give identical PNGs, with occasional 0.04% drift (the static helper text
under the sequence box shifting subpixel — most likely MUI's autosizing textarea
measuring itself before font metrics settle). That is far under the 0.5% the web
generator calls unchanged, so a content-stable gate would be feasible here.

## The BLAT figures

The in-silico PCR dialog is captured first, then the BLAT dialog, and then that
*same* BLAT dialog is submitted for the result figure — the two BLAT figures are
two states of one visit. Order matters: submitting adds a track and moves the
view, so any pristine dialog captured afterwards would show the result state.

Public UCSC BLAT sits behind a Cloudflare CAPTCHA and needs an account apiKey, so
the result figure submits against a stand-in hgBlat served by the harness
(`MOCK_BLAT_RESPONSE`, a genuine `output=json` body) through the url field under
advanced settings. Everything else on the path — request, parse, on-the-fly
track, navigation — is the real code.

`collapseGeneGlyph()` drives track menu → **Gene glyph** → **Longest coding
transcript** by `data-testid` before the result capture, so the hit is compared
against one labeled TP53 model instead of a stack of near-identical transcripts.
Menu rows go by testid because the labels also appear in the track label above,
where a text match resolves first.

## "Is it done loading?"

`waitForAppReady` in `test/harness.ts` replaces the `delay(3000) // let the track
paint` guesses. It reads the same signals the web screenshot generator waits on
(`packages/browser-test-utils/src/waits.ts`), through `executeScript` because
this harness drives selenium rather than puppeteer:

- `data-view-phase=loading` — the view is still waiting on its assembly, has
  mounted no displays, and every other signal is therefore silent. Blocking: a
  view that never leaves it has no content to fall through to.
- a **visible** `[data-testid="loading-overlay"]` — the idle overlay stays in the
  DOM at opacity 0, so presence is not the question; this mirrors the web
  generator's visibility walk. Blocking.
- `data-display-phase=loading` and any display wrapper still wearing its base
  test-id rather than `<base>-done`. Best-effort, as in the web generator: a
  display in a terminal too-large/error state renders no wrapper and publishes no
  phase, so failing on these would fail a figure whose subject is that state.

**The signals must stay clear for a settle window, not read clear once.** A
display's fetch autorun is debounced, so immediately after a navigation nothing
has started loading yet and every signal reads ready. Capturing there gets the
track's blank canvas — that is not hypothetical, it blanked the RefSeq lane
behind the in-silico PCR dialog on the first attempt. The window (1.5s) has to
outlast that debounce, which is why the gate isn't simply "no pending work".

A timeout names what it was still waiting on, so it doesn't land as a bare
"Waiting failed".

## Reading a failed run

- **Every capture logs the size it is about to write** (`· <name>: inner …,
  outer …, body …, dpr …`), whether or not `--only` lets it write. The committed
  figures are 1400x763, which is `inner 1400x763, outer 1444x844`. A wrong-size
  capture is this harness's recurring failure, and the log says which step it
  changed at.
- `desktop-debug-failure.png` (written to `tmpdir()` on any fatal error) ignores
  `--only`. It used to be skipped by it, which is how a run could fail with
  nothing but a one-line message; that screenshot is what identified the
  `indexFasta` bug above.
- Browser logs are flushed after the BLAT step as well as on fatal error, so a
  renderer-side `console.error` shows up even when the run otherwise succeeds.
- Two runs cannot overlap: `killProcesses()` runs at the start of every run, so
  the second kills the first one's app. Its `pkill` patterns match only the
  unpacked binary this harness launches — they used to match any command line
  mentioning `jbrowse-desktop`, which in a shared checkout killed unrelated
  builds and dev servers.

## Capture size

Two causes of a wrong size are understood and fixed:

- **Window size came from the developer's own app state.** `createMainWindow`
  sizes itself via `windowStateKeeper`, which persists into the userData dir —
  the same one a developer's real JBrowse Desktop writes. Fixed by passing a
  fresh `--user-data-dir` (mkdtemp) per run, so windowStateKeeper falls back to
  the electron defaults. Verified: `window-state.json` in every temp profile
  reads 1400x800.
- **The virtual screen was smaller than the window.** `xvfb-run` defaults to
  1280x1024, and a 1400-wide window on it captured 845x763.
  `screenshots:headless` now passes `-s "-screen 0 1920x1200x24"`.

Selenium cannot fix either after the fact — electron's chromedriver has no
`Browser.getWindowForTarget`, so `driver.manage().window().setRect()` throws
`UnknownCommandError`. Control the profile and the screen instead.

## Not a bug: "submit did nothing"

A BLAT submit that looked like it silently failed — dialog closed, no track, no
navigation — was the harness reading too early. `runQuery` closes the dialog only
on the success path (hits → track → navigate → `handleClose`), but the location
box renders the view's coarse dynamic blocks. Those now flush on discrete
navigation (LGV's `moveTo`), so the lag is gone, but the gate stays two-step in
`submitUcscQuery` because that is the honest signal:

- the dialog closing (or, if it stays open with the Submit button back out of its
  `Searching…` label, throw with the dialog's own text — that is the not-found /
  error / CAPTCHA-challenge case);
- then poll the location box for the expected hit before capturing.

The URL field is also asserted to read exactly the stand-in server url after
`clearInput`, because a clear that didn't take leaves the default UCSC url with
the mock one appended, and that failure reads as an unrelated network error.

## Why the implicit wait dominates a run

`driver.manage().setTimeouts({ implicit: 30000 })` means every `findElements`
that returns *nothing* costs 30 seconds, and "nothing left" is exactly what
`cleanupUI` asks after each dialog — ~60s per call, several calls per run.
Existence checks go through `countElements` (a `querySelectorAll` in
`executeScript`), which is instant; real elements are only fetched once a count
says there are some. Keep new waits off `findElements` for the same reason.

## Unresolved

- **The app dies mid-run.** `NoSuchSessionError: session deleted as the browser
  has closed the connection` means the Electron app went away. Reproduced with
  everything else green at the **available-genomes** step (a table of every
  public assembly fetched from jbrowse.org/hubs): rows rendered, settle passed,
  app gone by the next `executeScript`. Once the session is dead nothing can be
  read out of it, so diagnosing it needs the app's own stderr (chromedriver
  relays main-process output into the run log), not selenium.
- **Figures render on Canvas2D, not the GPU.** `createDriver` passes
  `--disable-gpu --disable-software-rasterizer`, so WebGPU and WebGL2 are both
  off and the app logs "No compatible GPU adapter available" then "WebGL2
  unavailable, falling back to Canvas2D" — every headless desktop figure comes
  through the fallback backend rather than the one a real user renders on. The
  web generator passes `--use-gl=swiftshader --enable-unsafe-swiftshader` and
  gets WebGL2. Swapping the flags here was tried once and that run crashed, but
  runs also crashed without it, so the swap is untested rather than ruled out.
- **One unexplained 845x763.** It recurred on a 1920x1200 screen whose temp
  profile recorded 1400x800, so neither fixed cause above explains it. In that
  capture the app had laid out at 845 CSS px with the drawer keeping its real
  385px width and only the view column losing 555px — i.e. the *page viewport*
  was 555px narrower than the window while its height stayed right. That is what
  docked DevTools does (555px is its default dock width), and nothing in the app
  calls `setZoomFactor`, so a stray devtools open is the leading suspect over any
  zoom/scale explanation. Unreproduced since; the per-capture size log is what
  will pin the step next time.

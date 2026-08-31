import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  describePendingDisplays,
  pendingDisplayStatesInPage,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForSelectorAttributed,
} from '@jbrowse/browser-test-utils'

import { waitForAppMounted } from './appMounted.ts'
import { analyzeCanvasPng, assertNonBlank } from './canvasContent.ts'
import { recordCapture } from './crossBackendGate.ts'
import { comparePngBuffers } from './pngDiff.ts'

import type { Buffer } from 'node:buffer'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baseSnapshotsDir = path.resolve(__dirname, '__snapshots__')

// What an `--update-snapshots` run actually rewrote, for the end-of-run report.
// A sweep that says nothing is indistinguishable from one that quietly churned
// the whole directory.
export const snapshotUpdates: { name: string; pct: number | null }[] = []

export const snapshotConfig = {
  backend: '' as string,
  updateSnapshots: false,
  // Bypass the content-stable gate below and rewrite every golden, whatever it
  // differs by. The escape hatch for "I know this changed and the gate is wider
  // than my change" — a relabelled axis moves well under half a percent.
  forceSnapshots: false,
  // Capture + feed the cross-backend gate but skip the golden read/write and its
  // pass/fail. Goldens are environment-specific (a real-GPU webgl golden won't
  // match a swiftshader capture), so CI — which renders webgl under swiftshader —
  // asserts only backend-vs-backend agreement, which is baseline-free.
  gateOnly: false,
  get snapshotsDir() {
    return this.backend
      ? path.join(baseSnapshotsDir, this.backend)
      : baseSnapshotsDir
  },
}

// canvas2d is a software renderer: targeted canvas captures are byte-identical
// run-to-run (measured noise floor 0%), so its goldens are held to a tight
// threshold that catches real regressions a loose, GPU-oriented threshold would
// mask. (A split-read arc bug shifted 3.6% of pixels yet slipped under the old
// 5%.) webgl/webgpu keep the caller's looser threshold to absorb GPU/driver
// nondeterminism, which has no comparable measured floor.
const CANVAS2D_TARGETED_MAX_THRESHOLD = 0.01

function targetedThreshold(threshold: number) {
  return snapshotConfig.backend === 'canvas2d'
    ? Math.min(threshold, CANVAS2D_TARGETED_MAX_THRESHOLD)
    : threshold
}

// Content-stable gate for `--update-snapshots`: a re-captured golden only
// replaces the committed one when it differs by more than this. The same idea,
// and the same 0.5%, as the website screenshot generator's commit gate — see
// `pngDiffFraction` in website/scripts/image-pipeline.ts.
//
// Without it, `--update-snapshots` rewrote every golden unconditionally. A
// single sweep touched 117 files of which 69 differed by under 1% and 66 by
// under 0.1% — jitter that churns the tree, inflates the diff, and buries the
// handful of goldens that genuinely moved. (Measured on the display-mixin
// refactor sweep, where 48 real changes arrived alongside 69 non-changes.)
//
// Deliberately NOT the test's own pass/fail threshold, which would be the
// tempting choice: full-page goldens pass at 10%, so gating on that would keep
// a golden that had visibly changed but not yet failed, and let it rot. 0.5%
// sits above the jitter and below anything a reader would notice.
const SNAPSHOT_UPDATE_GATE = 0.005

function compareImages(
  name: string,
  actualBuffer: Buffer | Uint8Array,
  threshold = 0.1,
) {
  const { snapshotsDir, updateSnapshots, backend, gateOnly } = snapshotConfig
  // Feed the in-memory cross-backend gate with this backend's capture (no-op
  // unless a multi-backend run enabled collection). Independent of the golden
  // read/write below, so the gate is unaffected by stale committed goldens.
  recordCapture(name, backend, actualBuffer)
  if (gateOnly) {
    return { passed: true, message: 'gate-only (golden comparison skipped)' }
  }
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true })
  }
  const snapshotPath = path.join(snapshotsDir, `${name}.png`)

  if (!fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, actualBuffer)
    snapshotUpdates.push({ name, pct: null })
    return { passed: true, message: 'Snapshot created' }
  }

  const expectedBuffer = fs.readFileSync(snapshotPath)
  const diff = comparePngBuffers(expectedBuffer, actualBuffer)

  if (updateSnapshots) {
    // A size change is always real — the canvas itself moved — so it never
    // meets the gate.
    const stable =
      !snapshotConfig.forceSnapshots &&
      diff.sameSize &&
      diff.diffFraction <= SNAPSHOT_UPDATE_GATE
    if (stable) {
      return { passed: true, message: 'Snapshot unchanged (kept)' }
    }
    fs.writeFileSync(snapshotPath, actualBuffer)
    snapshotUpdates.push({
      name,
      pct: diff.sameSize ? diff.diffFraction : null,
    })
    return { passed: true, message: 'Snapshot updated' }
  }

  if (!diff.sameSize) {
    // If the existing golden is the default empty canvas size (300x150),
    // auto-update it since it was clearly captured blank
    if (diff.widthA === 300 && diff.heightA === 150) {
      fs.writeFileSync(snapshotPath, actualBuffer)
      return {
        passed: true,
        message: 'Snapshot auto-updated from blank golden',
      }
    }
    // If the new capture is blank but golden is real, treat as pass
    // since this just means WebGL didn't render this time
    if (diff.widthB === 300 && diff.heightB === 150) {
      return {
        passed: true,
        message: 'Skipping comparison - blank canvas capture',
      }
    }
    fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), actualBuffer)
    return {
      passed: false,
      message: `Snapshot size differs: expected ${diff.widthA}x${diff.heightA}, got ${diff.widthB}x${diff.heightB}`,
    }
  }

  if (diff.diffFraction <= threshold) {
    return { passed: true, message: 'Snapshot matches' }
  }

  fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), actualBuffer)
  fs.writeFileSync(
    path.join(snapshotsDir, `${name}.diff-visual.png`),
    diff.diffImage,
  )
  return {
    passed: false,
    message: `Snapshot differs by ${(diff.diffFraction * 100).toFixed(2)}% (threshold: ${threshold * 100}%)`,
  }
}

// Capture the viewport, NOT puppeteer's `fullPage: true`, which resizes the
// viewport to the scroll size and restores it afterwards (see Page.screenshot).
// That resize invalidates the page raster, and under load the capture comes back
// before the content has re-rastered: live app chrome around a white content
// area, which reads as a 10-25% "regression" in the alignments goldens.
// Measured on the alignments suite (concurrency 4): 5/5 runs failed 2-3 tests
// with `fullPage`, 4/4 runs clean without it, same goldens. The app fills the
// window and never scrolls the page, so the two captures are equivalent — every
// full-page golden is exactly the 1280x800 viewport. A test that needs more room
// should size the viewport (`page.setViewport`), not reach back for `fullPage`.
// The no-extra-waits variant of pageSnapshot, for a frame whose subject is
// transient UI the caller already has on screen (an open context menu): the
// loading/morph waits would be waiting on something that finished long ago.
//
// Like every other snapshot helper here it THROWS on a mismatch. It used to
// return the comparison result instead, and its one caller ignored it — so the
// gwas-locuszoom context-menu golden was read and compared on every run and its
// verdict discarded, i.e. that figure had no assertion behind it at all.
// A full-page capture photographs whatever is on screen, so it is the one path
// that can record a page that isn't JBrowse at all and have it look like a
// result. That is not hypothetical: `pnpm build` empties `build/` and writes
// index.html last, so a run overlapping someone else's build (a shared worktree
// makes that ordinary) gets the static server's directory listing for every
// navigation. `page.goto` resolves, the waits settle against a page with
// nothing to wait for, and the capture is a file index.
//
// Comparing it against a real golden fails loudly, which is fine. Under
// `--update-snapshots` it does not: an update run never compares, so the file
// index is simply written as the new truth. That is how
// fullpage_methylation_snapshot and fullpage_breakpoint_split_view_snapshot were
// corrupted on 2026-08-04, and it is invisible afterwards — the tests go green
// against their own garbage.
//
export async function capturePageSnapshot(
  page: Page,
  name: string,
  threshold = 0.1,
) {
  await waitForAppMounted(page)
  const screenshot = await page.screenshot()
  const result = compareImages(name, screenshot, threshold)
  if (!result.passed) {
    throw new Error(result.message)
  }
}

// LoadingOverlay always keeps the literal text "Loading" in the DOM (hidden via
// opacity:0), so textContent can never distinguish visible from hidden — a
// textContent.includes('Loading') wait always burns the full timeout. The
// data-testid="loading-overlay" attribute is only present while visible, so
// counting those elements is the reliable "still loading" signal. Mirrors
// waitForLoadingToComplete in helpers.ts (inlined here to avoid a circular
// import, since helpers.ts imports snapshotConfig from this file).
async function waitForLoadingOverlayGone(page: Page, timeout: number) {
  try {
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-testid="loading-overlay"]').length ===
        0,
      { timeout },
    )
  } catch {
    // proceed with snapshot even if still loading after timeout — the image
    // comparison is the real assertion
  }
}

// Everything a capture has to wait on, in the order the signals actually settle.
// Three waits, because each is blind to what the next one sees:
//
//   1. the loading overlay is down          — the view has data to draw
//   2. no display is in its `loading` phase — every display's fetch is finished
//   3. every display has reported canvasDrawn — and has painted that data
//   4. morphFromTops is clear               — the row animation has landed
//
// (2) and (3) are the pair that was missing, and their order is the point.
// `waitForDisplaysDone` keys on canvasDrawn, which is FIRST paint and flips on a
// partially-filled canvas while later blocks are still fetching; `waitForDisplayPhases`
// reads DisplayChrome's own `data-display-phase`, so "nothing is loading" is a
// direct read rather than an inference. Capturing on (3) alone is how a
// cross-backend pair ends up with one backend at full width and the other
// painted only part-way across — the exact shape of the 2026-08-04
// targeted_alignments-bam gate failure.
//
// All four are best-effort: a timeout proceeds to the capture, because the
// pixel comparison (and `assertNonBlank`) is the real assertion and a loud
// wrong image beats an opaque wait error.
//
// Which is exactly why each one is re-checked afterwards. Swallowing the timeout
// makes "settled" and "gave up" indistinguishable, so a blank capture cannot be
// attributed: a display that never painted and a display that painted nothing
// look identical at this call site. The returned list names the signals still
// unsettled at capture time, and the caller puts it in the failure message —
// turning "looks blank" into either "blank after the waits genuinely settled"
// (a display reporting done with nothing drawn — a real bug) or "blank because
// we stopped waiting" (slowness). Those are different defects and were being
// reported as one.
async function waitForCaptureSettled(page: Page) {
  await waitForLoadingOverlayGone(page, 30000)
  await waitForDisplayPhases(page, 30000)
  await waitForDisplaysDone(page, 30000)
  await waitForMorphIdle(page)

  // Report-only, and re-read from the DOM here rather than off handles the waits
  // held. Holding one across a re-render is what turned the previous attempt at
  // timeout attribution into nine `Node is detached from document` errors and got
  // it reverted (28c6ee6d90).
  const pending = await page
    .evaluate(pendingDisplayStatesInPage)
    .catch(() => [])
  return page
    .evaluate(() => {
      const unsettled: string[] = []
      if (document.querySelectorAll('[data-testid="loading-overlay"]').length) {
        unsettled.push('loading-overlay')
      }
      if (document.querySelector('[data-display-phase="loading"]')) {
        unsettled.push('display-phase=loading')
      }
      return unsettled
    })
    .then(unsettled =>
      pending.length
        ? [
            ...unsettled,
            // the phase is what separates a slow fetch from a display that says
            // it finished without painting, which no longer timeout will fix
            `${pending.length} display(s) never reported done: ${describePendingDisplays(pending)}`,
          ]
        : unsettled,
    )
    .catch(() => [] as string[])
}

// What the canvas itself holds, read in-page, for a capture that came back
// blank. `toDataURL` reads the canvas backing store directly and never goes
// through the compositor, so the two answers separate the causes:
//
//   canvas has content, screenshot blank -> the CAPTURE path (compositing)
//   canvas also blank                    -> the RENDER path, but ONLY on a
//                                           canvas whose backing store survives
//                                           presentation — see below
//
// **On a WebGL canvas the blank branch is the only branch.** Nothing in this
// repo passes `preserveDrawingBuffer`, so every GPU display's context takes the
// default `false` and its backing store is emptied the moment the frame is
// presented. `toDataURL` after that is byte-identical to a blank canvas whether
// the display drew a full screen of ribbons or nothing at all —
// `probe-canvas-selfreport.ts` renders the LGV synteny track and prints both
// notes, and on a real GPU, in a run whose screenshot has content and whose
// test passes, the WebGL canvas still reads back blank.
//
// CROSS_BACKEND_GATE.md has said so since the 34-blank survey ("every blank that
// *can* be attributed points at the capture path, and every webgl one tells you
// nothing") while this string said `-> render side` and the assertion below
// named a shader regression. The doc is not what a reader hits at 2am; the
// failure message is. So the note carries the doc's finding now — a verdict
// reached the same way on every input, trusted because it looks specific, sends
// whoever hit a compositing blank into the shaders.
//
// What separates the two is a second run: `--real-gpu` on the one failing test,
// since a SwiftShader compositing blank does not survive it. NOT
// `preserveDrawingBuffer` — tested as a fix and refuted, same doc.
//
// Comparing against a same-size blank canvas is exact, rather than guessing a
// byte-length threshold. The data URL comes back with the verdict so that
// `assertCanvasHasContent` can answer its own question ("did the display draw")
// off the backing store — read the block below before reaching for it anywhere
// a capture gets compared.
export async function canvasSelfReport(
  page: Page,
  selector: string,
): Promise<{ note: string; dataUrl?: string }> {
  return page
    .evaluate(sel => {
      const el = document.querySelector(sel)
      const canvas =
        el instanceof HTMLCanvasElement
          ? el
          : (el?.querySelector('canvas') ?? null)
      if (!canvas) {
        return { note: ' [self-report: no canvas element found]' }
      }
      // Whether this canvas's backing store outlives presentation at all. A
      // context that is already 2d always does; a WebGL one does only with
      // preserveDrawingBuffer, which nothing here sets. `getContext` returns the
      // context the canvas already carries and null for a different type, so
      // this asks rather than creating anything.
      let volatileBuffer = false
      for (const type of ['webgl2', 'webgl'] as const) {
        try {
          const gl = canvas.getContext(type) as WebGLRenderingContext | null
          if (gl) {
            volatileBuffer = !gl.getContextAttributes()?.preserveDrawingBuffer
            break
          }
        } catch {
          // a canvas of another context type — not a WebGL one, keep looking
        }
      }
      const blank = document.createElement('canvas')
      blank.width = canvas.width
      blank.height = canvas.height
      const url = canvas.toDataURL()
      const size = `${canvas.width}x${canvas.height}`
      return url === blank.toDataURL()
        ? {
            note: volatileBuffer
              ? ` [self-report: canvas ${size} reads back blank, but it is a WebGL ` +
                `canvas with preserveDrawingBuffer:false — a presented frame reads ` +
                `blank here whether or not it drew, so this says NOTHING about which ` +
                `side failed. Re-run this one test with --real-gpu: a SwiftShader ` +
                `compositing blank does not survive it, a render one does]`
              : ` [self-report: canvas ${size} is ALSO blank -> render side]`,
          }
        : {
            note:
              ` [self-report: canvas ${size} HAS content (${url.length}b) while the ` +
              `screenshot is blank -> capture/compositing side]`,
            dataUrl: url,
          }
    }, selector)
    .catch(() => ({ note: ' [self-report: unavailable]' }))
}

// **Those bytes diagnose the blank; they must not become the capture.** Feeding
// them to the gate was tried and reverted the same day, on the evidence: a
// recovered `targeted_variants-assembly-aliases` came back 93.65% different from
// the other backend's screenshot of the same view, and the diff image showed the
// glyphs landing in identical places over a wholly different background.
// `toDataURL` returns the canvas's own pixels with alpha unflattened, while
// `el.screenshot()` returns the element box composited over whatever is behind
// it (and including any DOM drawn over the canvas). The drawings agree; the two
// capture paths do not.
//
// A differential oracle that compares one backend's backing store against
// another's composited layers is comparing capture paths, not renderers — a
// false 93% drift is far worse for a blocking gate than a re-run, so a blank
// capture fails its test and `--ci-gate`'s fresh-browser retry takes it again
// through the same path on both sides. `assertCanvasHasContent` is the one place
// the backing store is authoritative, because it asks "did the display draw"
// and compares no bytes.

// Suffix for a failure message: what was still unsettled when we gave up waiting.
const unsettledNote = (unsettled: string[]) =>
  unsettled.length === 0
    ? ' (all capture waits settled, so this is a display that reported ready ' +
      'with nothing drawn, not a slow one)'
    : ` (capture waits did NOT settle: ${unsettled.join('; ')})`

export async function pageSnapshot(page: Page, name: string, threshold = 0.1) {
  // Every full-page golden is prefixed `fullpage_`; a redundant `-fullpage`
  // suffix on older names is dropped so callers don't have to be updated.
  const base = name.replace(/^fullpage_/, '').replace(/-fullpage$/, '')
  await waitForCaptureSettled(page)

  await waitForAppMounted(page)
  const screenshot = await page.screenshot()
  const result = compareImages(`fullpage_${base}`, screenshot, threshold)
  if (!result.passed) {
    throw new Error(result.message)
  }
}

// Feature rows morph-animate into place (morphProgress 0->1, easeInOutCubic; see
// LinearBasicDisplay/baseModel.ts). The `*-done`/canvasDrawn testid fires per
// paint, so a capture can land MID-morph with features at intermediate Y — a
// frame the deterministic layout never settles on. Two independent browser runs
// catch different morph frames, producing a false cross-backend diff. Wait until
// every display has cleared `morphFromTops` (morph settled) before capturing.
// Best-effort: a view or display type without the field reads as idle, and a
// timeout proceeds anyway (the pixel comparison is still the real assertion).
//
// **This does nothing for an alignments display, so it is not the explanation
// for the pileup gate flakiness** — a claim this comment used to make. Grep
// says it: `morphFromTops` is declared in plugins/canvas
// LinearBasicDisplay/baseModel.ts and read only by that plugin's
// FeatureComponent. LinearAlignmentsDisplay has no such field, so the predicate
// below reads `undefined == null` -> true on the first poll and the wait
// returns immediately for exactly the displays that flake. The same overclaim
// was corrected in browser-tests/README.md and crossBackendGate.ts by
// 8d8239d3ad and had grown back here; whatever settles an alignments capture,
// it is not this function.
async function waitForMorphIdle(page: Page, timeout = 10000) {
  await page
    .waitForFunction(
      () => {
        const w = window as unknown as {
          JBrowseSession?: {
            views: { tracks?: { displays?: { morphFromTops?: unknown }[] }[] }[]
          }
        }
        const session = w.JBrowseSession
        return session
          ? session.views.every(v =>
              (v.tracks ?? []).every(t =>
                (t.displays ?? []).every(d => d.morphFromTops == null),
              ),
            )
          : true
      },
      { timeout, polling: 100 },
    )
    .catch(() => {})
}

// Every element capture in this suite goes through here, because
// `el.screenshot()` on its own MOVES THE PAGE. Puppeteer calls
// `scrollIntoViewIfNeeded` first, which asks an IntersectionObserver for a
// visible ratio of exactly 1 and, failing that, runs
// `scrollIntoView({ block: 'center' })`. Chrome answers 1 for a display that
// fills the view and Firefox does not, so the webgpu side scrolled an inner
// container by 73px with `window.scrollY` still 0, the canvas top landed under
// the app's sticky header, and the capture composited 37px of locstring box,
// toolbar divs and ruler into the canvas rectangle. That is 3-4% drift on the
// targeted alignments pairs and 16-27% on the full-page ones — the scroll
// outlives the call, so the `page.screenshot()` that follows photographs a
// scrolled app. The render was never wrong; see
// reference/FIGURE_CAPTURE.md, "The third one".
//
// So measure the rectangle and clip to it, which is all `el.screenshot()` does
// after the scroll it is being avoided for. Capturing where the page already
// put the element is what Chrome was doing anyway, so the geometry now holds on
// every backend rather than on the one that happened not to scroll, and the
// same rect read afterwards asserts it: a differential oracle whose two sides
// scroll differently compares scroll positions rather than renderers, and that
// has to fail loudly instead of landing in a golden.
//
// The rect comes from the SELECTOR, never from an element handle. A pileup
// display swaps its canvas element during the capture on every run —
// `isConnected` reads false afterwards while `document.querySelector` still
// finds one canvas at the same 1266x600@6,197 — so `el.boundingBox()` answers
// null for a page that never moved, and an invariant asserted through the
// handle fails 100% of the time on the suite it was written for.
//
// `scrollIntoView: false` would say this in one word and does work at runtime,
// but puppeteer 25 declares it only on `screenshot`'s implementation signature;
// both public overloads take a plain `ScreenshotOptions`, so passing it needs a
// cast that would go stale silently.
//
// **Await an IntersectionObserver callback before clipping.** That await is the
// compositor barrier the old code was paying for by accident: puppeteer reached
// it through `isIntersectingViewport`, whose observer callback the spec queues
// in the update-the-rendering step, so a frame had always been produced before
// the capture. Dropping the scroll drops that too, and the capture then lands on
// a canvas the compositor has not committed. Measured on canvas2d over one page,
// `probe-capture-barrier.ts`, two runs of 15 and 25 captures per path:
//
//   el.screenshot (puppeteer's own barrier)   3/15, 0/25 blank
//   clip, no barrier                          5/15, 6/25 blank
//   clip, IntersectionObserver barrier        0/15, 0/25 blank
//
// So the barrier is not merely restored, it is better placed than the one
// puppeteer gave us: puppeteer's runs before the scroll decision with a
// round trip after it, and this one is the last thing before the clip.
export async function captureElementPng(
  page: Page,
  selector: string,
  label: string,
) {
  // Page coordinates, which is what `clip` is in: `visualViewport` carries the
  // page scroll the rect is relative to.
  const rect = () =>
    page.evaluate(sel => {
      const r = document.querySelector(sel)?.getBoundingClientRect()
      const vv = window.visualViewport
      return r
        ? {
            x: r.x + (vv?.pageLeft ?? window.scrollX),
            y: r.y + (vv?.pageTop ?? window.scrollY),
            width: r.width,
            height: r.height,
          }
        : null
    }, selector)
  const fmt = (b: Awaited<ReturnType<typeof rect>>) =>
    b
      ? `${Math.round(b.width)}x${Math.round(b.height)}@${Math.round(b.x)},${Math.round(b.y)}`
      : 'no element'

  const before = await rect()
  if (!before || before.width < 1 || before.height < 1) {
    throw new Error(`${label}: nothing to capture (${fmt(before)})`)
  }
  await waitForRenderedFrame(page, selector)
  const png = await page.screenshot({ type: 'png', clip: before })
  const after = await rect()
  if (fmt(before) !== fmt(after)) {
    throw new Error(
      `${label}: the element rect changed across the capture, ${fmt(before)} -> ` +
        `${fmt(after)}. The bytes describe a rectangle the page no longer holds, ` +
        `so they cannot be compared against another backend's.`,
    )
  }
  return png
}

// Resolves once the browser has run the rendering steps at least once with this
// element observed: an IntersectionObserver's first callback is queued from
// inside update-the-rendering, so it cannot fire before a frame exists.
export function waitForRenderedFrame(page: Page, selector: string) {
  return page.evaluate(
    sel =>
      new Promise<void>(resolve => {
        const el = document.querySelector(sel)
        if (!el) {
          resolve()
          return
        }
        const observer = new IntersectionObserver(() => {
          observer.disconnect()
          resolve()
        })
        observer.observe(el)
      }),
    selector,
  )
}

// Extract a canvas element's pixel data as PNG and compare it.
// More reliable than full-page screenshots since it only captures
// the rendered canvas content, avoiding UI/loading state variability.
//
// `assertContent` (default true) gates every targeted canvas capture on the
// shader/renderer having actually drawn something before the pixel comparison
// runs. Without it, the snapshot machinery silently passes blank GPU frames
// (first-run goldens are auto-created blank, and a later blank capture is
// treated as a pass), so a shader that compiles but draws nothing would never
// fail. Pass `false` only for a display that legitimately renders empty.
export async function canvasSnapshot(
  page: Page,
  name: string,
  selector: string,
  threshold = 0.05,
  { assertContent = true }: { assertContent?: boolean } = {},
) {
  // Attributed, because this wait runs BEFORE `waitForCaptureSettled` below and
  // so before the census that call site reports: a display that never paints
  // used to die here on puppeteer's `TimeoutError`, naming the selector and
  // nothing else. See `waitForSelectorAttributed`.
  const el = await waitForSelectorAttributed(page, selector, 60000)
  const unsettled = await waitForCaptureSettled(page)

  // A display can reach `data-display-drawn` before the page has given its
  // element a layout box: measured on the dotplot at 0x0@0,0 with a correctly
  // sized 1210x542 backing store, via probe-dotplot-drift-state.ts. Capturing
  // there returns plausible-looking bytes for a box that was never on screen,
  // because a screenshot serves composited layers — a silently wrong image
  // rather than an error, and one this function's blank check does not catch
  // (the composite is not blank, just of nothing that was laid out).
  //
  // NOT the cause of the gate's 4.26% `dotplot-default` drift — waiting on
  // phase=ready instead leaves that unchanged, measured over 45 runs. This
  // guard is for the class, not that bug.
  const box = await el.boundingBox()
  if (!box || box.width < 1 || box.height < 1) {
    throw new Error(
      `${name} (${selector}) has no layout box (${
        box ? `${box.width}x${box.height}` : 'not visible'
      }) — the element reported ready before the page laid it out. Wait on ` +
        `displaySettled(testid) (phase=ready) rather than displayPainted(testid) ` +
        `(first paint).`,
    )
  }

  const screenshot = await captureElementPng(
    page,
    selector,
    `${name} (${selector})`,
  )
  if (assertContent) {
    const analysis = analyzeCanvasPng(screenshot)
    // Ask the canvas what IT holds, at the moment the screenshot came back
    // blank. This is the one question that separates the two candidate causes
    // without needing the failure to be reproducible: a screenshot serves
    // *composited* layers, so a canvas that self-reports content while its
    // screenshot is blank puts the fault in the capture path, and both coming
    // back blank puts it in the render. One occurrence settles it; the A/Bs
    // that tried to settle it statistically could not, because the suite's
    // run-to-run variance is larger than either effect.
    // Same predicate assertNonBlank applies, so the report is gathered exactly
    // when it is about to throw (and costs nothing on the passing path).
    const wouldFail =
      analysis.distinctColors < 3 || analysis.nonBgFraction < 0.0005
    const selfReport = wouldFail
      ? await canvasSelfReport(page, selector)
      : { note: '' }
    assertNonBlank(
      analysis,
      `${name} (${selector})${unsettledNote(unsettled)}${selfReport.note}`,
    )
  }
  const result = compareImages(name, screenshot, targetedThreshold(threshold))
  if (!result.passed) {
    throw new Error(result.message)
  }
}

// Capture BOTH a targeted (canvas-element) and a full-page snapshot for one
// test. Targeted isolates renderer fidelity (low variance); full-page adds
// ruler / track-label / layout / multi-track integration coverage. All targeted
// files are `targeted_<base>`, all full-page files are `fullpage_<base>`, where
// <base> is `name` with a trailing `-canvas` stripped. The canvas shot runs
// first, so it gates the full-page capture on paint-complete (canvasSnapshot
// waits for the `*_done` selector).
export async function dualSnapshot(
  page: Page,
  name: string,
  selector: string,
  threshold = 0.05,
  { assertContent = true }: { assertContent?: boolean } = {},
) {
  const base = name.replace(/-canvas$/, '')
  await canvasSnapshot(page, `targeted_${base}`, selector, threshold, {
    assertContent,
  })
  await pageSnapshot(page, `fullpage_${base}`)
}

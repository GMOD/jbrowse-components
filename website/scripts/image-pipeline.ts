import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'

import sharp, { type OutputInfo } from 'sharp'

// A regen re-renders every spec, but an unchanged spec re-renders byte-for-byte
// identical (rendering is deterministic). Writing them all back would churn the
// whole static/img dir on every commit. So a freshly captured PNG only replaces
// the committed one when it differs by more than `diffThreshold` of its pixels —
// the same diffFraction gate jbrowse-web/browser-tests/pngDiff.ts uses, here via
// ImageMagick (already a dependency alongside pngquant) instead of pixelmatch.

// ImageMagick 7's own name for its CLI; 6 only ships the individual tools, and
// 7 prints a deprecation warning for every `convert` invocation.
const HAS_MAGICK = spawnSync('magick', ['-version']).status === 0
export const IM = HAS_MAGICK ? 'magick' : 'convert'
// `identify` as a standalone binary is IM6's layout; an IM7 install can ship
// only `magick`, where the same tool is the `magick identify` subcommand.
const IDENTIFY_BIN = HAS_MAGICK ? 'magick' : 'identify'
const IDENTIFY_ARGS = HAS_MAGICK ? ['identify'] : []

// Percentage of the difference image a channel must exceed to count as changed —
// the fuzz tolerance that lets sub-pixel glyph jitter through.
const DIFF_FUZZ = '5%'

// Fraction in [0,1] of pixels that differ (fuzz-tolerant), or null when the two
// images are different sizes / the comparison couldn't run (treated as changed).
//
// This deliberately does NOT use `compare -metric AE`. On ImageMagick 7 Q16-HDRI
// that metric is no longer a differing-pixel count — an 11x11 edit on a 2000x1100
// capture reports 3.5e6 against 2.2e6 total pixels — so the fraction came out
// hundreds of times too large and every spec read as changed, quietly defeating
// the whole content-stable gate. Thresholding the difference image and taking its
// mean is a plain fraction-of-pixels in every ImageMagick build.
//
// The difference is flattened with `-grayscale Brightness` (max of R/G/B), NOT
// `-colorspace Gray` (Rec709 luminance). Luminance weights blue at 0.0722, so a
// blue-only recolor had to move a channel by 69% before it cleared the 5%
// threshold at all: recoloring a quarter of the frame #0000ff -> #0000aa measured
// 0.000% and read as "unchanged". Brightness thresholds every channel on its own
// merits, which is what a per-pixel "did this change" test means. Verified
// bit-identical to `-separate -threshold -evaluate-sequence Max` across 25
// consecutive figure revisions, at the same cost.
//
// The thresholded difference is then eroded by a pixel, because the raw fraction
// cannot tell a changed figure from a changed Chrome. A browser update shifts
// glyph metrics fractionally, which repaints the antialiased outline of every
// character in the capture — measured at 0.505-0.545% across six figures on the
// 25.3 -> 25.4 puppeteer bump, i.e. straddling the 0.5% gate, so which figures
// got rewritten was a coin flip and the rewrites were invisible. Those fringes
// are one pixel wide and vanish under an erode; a real change (a moved element,
// a recolor, a different menu item) is a solid region that survives it. On the
// same six, erosion drops the noise to 0.11-0.18% while a genuinely changed
// figure only falls from 5.0% to 3.8%.
export function pngDiffFraction(a: string, b: string): number | null {
  const [sizeA, sizeB] = [a, b].map(f =>
    (
      spawnSync(IDENTIFY_BIN, [...IDENTIFY_ARGS, '-format', '%w %h', f], {
        encoding: 'utf8',
      }).stdout || ''
    ).trim(),
  )
  // -composite silently works over the first image's geometry when the two
  // differ, so a resize has to be ruled out here rather than by the comparison.
  if (!sizeA || sizeA !== sizeB) {
    return null
  }
  const out = spawnSync(
    IM,
    [
      a,
      b,
      '-compose',
      'difference',
      '-composite',
      '-grayscale',
      'Brightness',
      '-threshold',
      DIFF_FUZZ,
      '-morphology',
      'Erode',
      'Diamond:1',
      '-format',
      '%[fx:mean]',
      'info:',
    ],
    { encoding: 'utf8' },
  )
  const frac = Number.parseFloat((out.stdout || '').trim())
  return Number.isFinite(frac) ? frac : null
}

// Rows of uninterrupted page background along the bottom of a capture, in image
// pixels, or null if it could not be measured.
//
// Pixel dimensions of an image, for the callers that have to lay something out
// over one: the compose step, which puts an anchor element over each part's own
// box. Via sharp's header read rather than `identify`, so it costs no process.
export async function imageSize(file: string) {
  const { width, height } = await sharp(file).metadata()
  if (!width || !height) {
    throw new Error(`could not read the dimensions of ${file}`)
  }
  return { width, height }
}

// A spec's `viewportHeight` is a hand-picked number that ages badly: it is sized
// to whatever the app laid out on the day it was written, and any later change
// to how tall something renders leaves the difference as dead grey under the
// content. Nothing else notices — the figure still renders, the diff gate still
// says unchanged — so it is only ever caught by somebody looking at the PNG. An
// external plugin that stopped centering its canvas in a fixed box left 265-390px
// under three graph figures exactly this way.
//
// Measured against the image's own bottom row rather than a hardcoded page
// color, so it holds for either theme and for the odd figure captured on a
// non-default background: reduce each row to its mean grey and walk up while
// rows still match the bottom one. A row with any content in it moves the mean,
// and content that only shifts the mean by less than the tolerance is not
// something a reader would see either.
//
// In-process via sharp (already a website dependency, for the gallery thumbs)
// rather than the `magick … txt:-` dump this used to parse. That version piped
// one text line per image row back through a 64 MB buffer and regexed it, which
// is a lot of machinery to compute an average. It also measured the mean of a
// 16-bit downscale rather than the mean, so its answers were a pixel or two off
// on the images where IM's box filter rounded. Verified against it over a
// sample: identical on three of four figures, 2px apart on the fourth, all of
// them decades below the SLACK_WARN_PX gate either way, and 2-4x faster.
export async function trailingBackgroundPx(
  file: string,
): Promise<number | null> {
  // null, never a throw, on anything unreadable. This measures a warning, and
  // the call site is inside the per-spec try that decides whether the capture
  // failed, so a decode error here would report a figure that rendered fine as
  // a broken spec. The shelled-out version got this for free by returning empty
  // stdout; sharp rejects, so it has to be said.
  let data: Buffer
  let info: OutputInfo
  try {
    ;({ data, info } = await sharp(file)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true }))
  } catch {
    return null
  }
  const { width, height, channels } = info
  if (height < 2 || width < 1) {
    return null
  }
  const rows = new Float64Array(height)
  for (let y = 0; y < height; y++) {
    const start = y * width * channels
    let sum = 0
    for (let x = 0; x < width; x++) {
      sum += data[start + x * channels]!
    }
    rows[y] = sum / width
  }
  const background = rows[height - 1]!
  // 1/255 of full scale: below what a reader could distinguish, and above the
  // rounding in an 8-bit row mean.
  const tolerance = 1
  let count = 0
  for (let y = height - 1; y >= 0; y--) {
    if (Math.abs(rows[y]! - background) > tolerance) {
      break
    }
    count++
  }
  // An all-background image is a blank capture, which is a different failure and
  // is caught by assertViewsRendered; reporting its whole height as slack would
  // just be noise.
  return count === height ? 0 : count
}

// copyFileSync (not rename) because tmpPath and static/img may be on different
// filesystems. But copying straight onto outputPath leaves a window where the
// file on disk is half old and half new, and these PNGs are read while a regen
// runs: the review server serves them to the reviewer and sha1s them to stamp a
// verdict, and a hash taken of a half-written capture pins a verdict that can
// never match again. So stage beside the output — same directory, therefore
// same filesystem — and rename, which no reader can observe partway through.
function moveIntoPlace(tmpPath: string, outputPath: string) {
  const staging = `${outputPath}.${process.pid}.tmp`
  try {
    fs.copyFileSync(tmpPath, staging)
    fs.renameSync(staging, outputPath)
  } finally {
    fs.rmSync(staging, { force: true })
    fs.rmSync(tmpPath, { force: true })
  }
}

// `path` is the figure this call wrote (or would have), carried on the result
// because the caller cannot re-derive it: most specs land in outDir under their
// own name, jbrowse-img specs land in jbrowseImgOutDir, and a compose spec is
// assembled from several. The end-of-run push hint needs the exact set of files
// the run touched, and a name-to-path guess is what it is here to avoid.
export type CommitResult =
  | { status: 'new'; path: string }
  | { status: 'updated'; detail: string; path: string }
  | { status: 'kept'; frac: number; raisedGate: boolean; path: string }

// Move a freshly captured PNG into place only when its content actually changed
// (or with force / for a brand-new spec), so a regen doesn't rewrite every PNG.
// Returns what happened so callers can roll it into an end-of-run summary.
//
// `baseThreshold` is the run's global gate. A spec that raises its own
// `diffThreshold` to absorb layout jitter also raises it for real changes, so a
// keep that only happened because of the raised value is flagged `raisedGate`
// for the caller to surface. That case is a genuine trap: a deliberate recolor
// of one bar moves ~2.4% of pixels, which a jitter-driven 10% threshold silently
// keeps, and the run reads as successful while publishing the old image.
export function commitScreenshot(
  tmpPath: string,
  outputPath: string,
  name: string,
  {
    force,
    diffThreshold,
    baseThreshold = diffThreshold,
  }: { force: boolean; diffThreshold: number; baseThreshold?: number },
): CommitResult {
  const isNew = !fs.existsSync(outputPath)
  if (force || isNew) {
    moveIntoPlace(tmpPath, outputPath)
    console.log(`  ✓ ${name}.png${isNew ? ' (new)' : ''}`)
    return isNew
      ? { status: 'new', path: outputPath }
      : { status: 'updated', detail: 'forced', path: outputPath }
  } else {
    const frac = pngDiffFraction(tmpPath, outputPath)
    if (frac !== null && frac < diffThreshold) {
      fs.rmSync(tmpPath, { force: true })
      const raisedGate = frac >= baseThreshold
      const pct = (n: number) => `${(n * 100).toFixed(3)}%`
      console.log(
        raisedGate
          ? `  ⚠ ${name}.png (kept; ${pct(frac)} exceeds the ${pct(baseThreshold)} default and was kept only by this spec's diffThreshold ${pct(diffThreshold)} — re-run with --force if the change was intended)`
          : `  ≈ ${name}.png (kept; ${pct(frac)} < ${pct(diffThreshold)} threshold)`,
      )
      return { status: 'kept', frac, raisedGate, path: outputPath }
    } else {
      moveIntoPlace(tmpPath, outputPath)
      const detail =
        frac === null ? 'resized' : `${(frac * 100).toFixed(2)}% diff`
      console.log(`  ✓ ${name}.png (updated, ${detail})`)
      return { status: 'updated', detail, path: outputPath }
    }
  }
}

// PNG color type 3 is "indexed-color", i.e. what pngquant writes. It is the byte
// after the bit depth in IHDR, which is the first chunk and always at a fixed
// offset: 8-byte signature, then the chunk's 4-byte length and 4-byte type, then
// width, height, bit depth. Read straight rather than shelling out to identify —
// this runs once per figure in a 288-spec sweep.
function isPalettePng(file: string) {
  const head = Buffer.alloc(26)
  const fd = fs.openSync(file, 'r')
  try {
    if (fs.readSync(fd, head, 0, head.length, 0) < head.length) {
      return false
    }
  } finally {
    fs.closeSync(fd)
  }
  return head.subarray(12, 16).toString('latin1') === 'IHDR' && head[25] === 3
}

// Lossily quantize a PNG in place with pngquant. These captures are flat-color
// UI screenshots with small palettes, so quantization shrinks them ~50-60% with
// no perceptible quality loss — worth it for a static site served over the
// network. Best-effort: if pngquant isn't installed (or the result would be
// larger), leave the original untouched and keep going.
//
// `--nofs` disables Floyd-Steinberg dithering. Dithering is the wrong tool for
// flat UI screenshots: it scatters error-diffusion noise across translucent
// chrome (button hover/focus fills, overlays), and that noise pattern is
// *amplified* from sub-pixel render jitter — two byte-different-but-visually-
// identical renders dither into wildly different speckle, flipping enough pixels
// to blow past the content-stable diff gate and churn the committed PNG on every
// regen. Without dithering, near-identical input maps to the same palette colors,
// so an unchanged spec re-renders byte-for-byte. Bonus: it also shrinks the files
// (~40% on chrome-heavy captures) since the dither noise was pure entropy.
//
// A LADDER OF FLOORS, because the strict pass silently gives up on exactly the
// figures that need it most. pngquant fails (leaving the PNG untouched) when it
// cannot hit the quality floor in 256 colors, and the images that defeat it are
// the dense ones: a whole-genome ribbon stack drawn at a low per-feature alpha
// blends tens of thousands of hairlines into a huge palette of near-white
// tints, which is both incompressible and unquantizable at 90. Those shipped
// unoptimized at 4-8 MB while every flat UI capture around them was under 1 MB
// — the site serves static/img directly, with no resizing layer, so that is
// what a reader downloads. Each floor is only ever reached by an image the one
// above it refused, so nothing that quantizes cleanly today changes.
//
// The floor is a give-up threshold, not a quality dial: on the ribbon stacks,
// 60, 50 and 40 all produce the byte-identical palette, and the only thing the
// number decides is whether pngquant writes it. So a floor that is too high
// buys no fidelity — it just ships the 4 MB original. Measured on the two
// figures that reach the bottom rung, orthofinder_synteny/vertebrates
// (3.8 -> 1.3 MB, RMSE 1.6%) and wheat (5.5 -> 1.4 MB, RMSE 1.8%), which is the
// same error band the 70 rung was already accepted at, with no banding visible
// in the ribbons.
//
// vertebrates is why 60 is here: it quantized at 70 until its per-link alpha was
// raised from 0.15 to 0.3, which moved it one rung down and, with only two rungs,
// off the ladder — a figure tripling in bytes with nothing in the diff to say so.
export function optimizePng(file: string) {
  // Quantizing an already-quantized PNG is not a no-op: pngquant re-derives a
  // palette from the palette, so a second call spends another RMSE budget and
  // writes different bytes. In a regen the input is always a fresh TrueColor
  // render, but this is also the one-liner you reach for to re-optimize a
  // committed figure after changing the ladder, and there a double call would
  // quietly compound the loss.
  if (isPalettePng(file)) {
    return
  }
  for (const quality of ['90-100', '70-100', '60-100']) {
    try {
      execFileSync(
        'pngquant',
        [
          '--nofs',
          `--quality=${quality}`,
          '--skip-if-larger',
          '--force',
          '--ext',
          '.png',
          file,
        ],
        { stdio: 'ignore' },
      )
      return
    } catch (e) {
      // pngquant exits non-zero when it skips (e.g. --skip-if-larger), which is
      // fine; only surface a hint if the binary is genuinely missing
      if ((e as { code?: string }).code === 'ENOENT') {
        console.error('    pngquant not found; skipping image optimization')
        return
      }
    }
  }
  // Falling off the bottom of the ladder ships the raw render. That is the
  // right thing to do — a figure is better large than banded — but it is not a
  // thing to do quietly: it is how vertebrates tripled in bytes unnoticed. Say
  // it, with the size, so a regen that pushes a figure off the ladder reads as
  // an event in the log rather than as a silent success.
  const mb = (fs.statSync(file).size / 1e6).toFixed(1)
  console.error(
    `    ${file}: no pngquant floor met, shipping ${mb} MB unquantized`,
  )
}

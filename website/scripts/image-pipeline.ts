import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'

// A regen re-renders every spec, but an unchanged spec re-renders byte-for-byte
// identical (rendering is deterministic). Writing them all back would churn the
// whole static/img dir on every commit. So a freshly captured PNG only replaces
// the committed one when it differs by more than `diffThreshold` of its pixels —
// the same diffFraction gate jbrowse-web/browser-tests/pngDiff.ts uses, here via
// ImageMagick (already a dependency alongside pngquant) instead of pixelmatch.

// ImageMagick 7's own name for its CLI; 6 only ships the individual tools, and
// 7 prints a deprecation warning for every `convert` invocation.
export const IM =
  spawnSync('magick', ['-version']).status === 0 ? 'magick' : 'convert'

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
export function pngDiffFraction(a: string, b: string): number | null {
  const [sizeA, sizeB] = [a, b].map(f =>
    (
      spawnSync('identify', ['-format', '%w %h', f], { encoding: 'utf8' })
        .stdout || ''
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
      '-colorspace',
      'Gray',
      '-threshold',
      DIFF_FUZZ,
      '-format',
      '%[fx:mean]',
      'info:',
    ],
    { encoding: 'utf8' },
  )
  const frac = Number.parseFloat((out.stdout || '').trim())
  return Number.isFinite(frac) ? frac : null
}

// copyFileSync (not rename) because tmp and static/img may be on different
// filesystems.
function moveIntoPlace(tmpPath: string, outputPath: string) {
  fs.copyFileSync(tmpPath, outputPath)
  fs.rmSync(tmpPath, { force: true })
}

export type CommitResult =
  | { status: 'new' }
  | { status: 'updated'; detail: string }
  | { status: 'kept' }

// Move a freshly captured PNG into place only when its content actually changed
// (or with force / for a brand-new spec), so a regen doesn't rewrite every PNG.
// Returns what happened so callers can roll it into an end-of-run summary.
export function commitScreenshot(
  tmpPath: string,
  outputPath: string,
  name: string,
  { force, diffThreshold }: { force: boolean; diffThreshold: number },
): CommitResult {
  const isNew = !fs.existsSync(outputPath)
  if (force || isNew) {
    moveIntoPlace(tmpPath, outputPath)
    console.log(`  ✓ ${name}.png${isNew ? ' (new)' : ''}`)
    return isNew ? { status: 'new' } : { status: 'updated', detail: 'forced' }
  } else {
    const frac = pngDiffFraction(tmpPath, outputPath)
    if (frac !== null && frac < diffThreshold) {
      fs.rmSync(tmpPath, { force: true })
      console.log(
        `  ≈ ${name}.png (kept; ${(frac * 100).toFixed(3)}% < ${(diffThreshold * 100).toFixed(3)}% threshold)`,
      )
      return { status: 'kept' }
    } else {
      moveIntoPlace(tmpPath, outputPath)
      const detail =
        frac === null ? 'resized' : `${(frac * 100).toFixed(2)}% diff`
      console.log(`  ✓ ${name}.png (updated, ${detail})`)
      return { status: 'updated', detail }
    }
  }
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
export function optimizePng(file: string) {
  try {
    execFileSync(
      'pngquant',
      [
        '--nofs',
        '--quality=70-90',
        '--skip-if-larger',
        '--force',
        '--ext',
        '.png',
        file,
      ],
      { stdio: 'ignore' },
    )
  } catch (e) {
    // pngquant exits non-zero when it skips (e.g. --skip-if-larger), which is
    // fine; only surface a hint if the binary is genuinely missing
    if ((e as { code?: string }).code === 'ENOENT') {
      console.error('    pngquant not found; skipping image optimization')
    }
  }
}

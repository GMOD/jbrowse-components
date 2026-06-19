import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'

// A regen re-renders every spec, but an unchanged spec re-renders byte-for-byte
// identical (rendering is deterministic). Writing them all back would churn the
// whole static/img dir on every commit. So a freshly captured PNG only replaces
// the committed one when it differs by more than `diffThreshold` of its pixels —
// the same diffFraction gate jbrowse-web/browser-tests/pngDiff.ts uses, here via
// ImageMagick `compare` (already a dependency alongside convert/pngquant)
// instead of pixelmatch.

// Fraction in [0,1] of pixels that differ (fuzz-tolerant), or null when the two
// images are different sizes / the comparison couldn't run (treated as changed).
export function pngDiffFraction(a: string, b: string): number | null {
  // `compare` writes the metric to stderr and exits 0 (within fuzz), 1
  // (differ), or 2 (error, e.g. dimension mismatch).
  const cmp = spawnSync(
    'compare',
    ['-metric', 'AE', '-fuzz', '5%', a, b, 'null:'],
    { encoding: 'utf8' },
  )
  if (cmp.error || cmp.status === 2) {
    return null
  }
  const ae = Number.parseFloat((cmp.stderr || '').trim().split(/\s+/)[0] ?? '')
  if (!Number.isFinite(ae)) {
    return null
  }
  const id = spawnSync('identify', ['-format', '%w %h', a], {
    encoding: 'utf8',
  })
  const [w, h] = (id.stdout || '').trim().split(/\s+/).map(Number)
  const total = (w ?? 0) * (h ?? 0)
  return total > 0 ? ae / total : null
}

// copyFileSync (not rename) because tmp and static/img may be on different
// filesystems.
function moveIntoPlace(tmpPath: string, outputPath: string) {
  fs.copyFileSync(tmpPath, outputPath)
  fs.rmSync(tmpPath, { force: true })
}

// Move a freshly captured PNG into place only when its content actually changed
// (or with force / for a brand-new spec), so a regen doesn't rewrite every PNG.
export function commitScreenshot(
  tmpPath: string,
  outputPath: string,
  name: string,
  { force, diffThreshold }: { force: boolean; diffThreshold: number },
) {
  const isNew = !fs.existsSync(outputPath)
  if (force || isNew) {
    moveIntoPlace(tmpPath, outputPath)
    console.log(`  ✓ ${name}.png${isNew ? ' (new)' : ''}`)
  } else {
    const frac = pngDiffFraction(tmpPath, outputPath)
    if (frac !== null && frac < diffThreshold) {
      fs.rmSync(tmpPath, { force: true })
      console.log(
        `  ≈ ${name}.png (kept; ${(frac * 100).toFixed(3)}% < ${diffThreshold * 100}% threshold)`,
      )
    } else {
      moveIntoPlace(tmpPath, outputPath)
      const detail =
        frac === null ? 'resized' : `${(frac * 100).toFixed(2)}% diff`
      console.log(`  ✓ ${name}.png (updated, ${detail})`)
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

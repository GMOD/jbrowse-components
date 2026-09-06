import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { isDerivedFigure } from './figure-store.ts'

// Regenerates the homepage hero (static/img/screenshot.webp) and its webp
// twins from committed figure PNGs, so the homepage can't drift from the app
// the way a hand-made capture does — the previous hero was a Hi-C shot from
// 2024 whose alt text described a different view entirely. The hero keeps its
// chrome: the whole point of that image is that it looks like an application.
//
// Output is gitignored and excluded from the figure store, and `dev`, `build`
// and `index` regenerate it — the same arrangement, for the same reason, as
// gen-tutorial-thumbs.ts.

interface ImageSpec {
  // Source figure under static/img.
  src: string
  // Vertical slice to frame, as [top, bottom] fractions of source height.
  // Omit to use the whole height.
  band?: [number, number]
  // Horizontal slice, as [left, right] fractions of source width — for a
  // multi-panel figure where only one panel is the subject. Omit for full
  // width.
  xband?: [number, number]
  // Letterbox the framed region onto this background instead of cropping it to
  // the card aspect. Only worth it when the region is a uniform-background
  // panel (the molstar canvas) whose subject would otherwise be cropped.
  pad?: string
  // Output size. Omit height to scale the framed region to width.
  width: number
  height?: number
  quality?: number
}

const HERO: ImageSpec = {
  src: 'sv_cgiab/deletion_linear_view.png',
  width: 1400,
}

// Homepage figures that are the same picture as a committed capture, only in
// webp. Derived for exactly the reason the hero is, and it had already
// happened: measured 2026-08-08, static/img/desktop-available-genomes.webp was
// a hand-made copy dated Jul 19 sitting beside a desktop capture recaptured
// Aug 1, and 26% of its pixels disagreed with it. Nothing reported that. The
// review tooling reads the png, the homepage serves the webp, and only the png
// gets recaptured. Keyed by output name under static/img.
const DERIVED: Record<string, ImageSpec> = {
  'desktop-available-genomes': {
    src: 'desktop-available-genomes.png',
    width: 1400,
  },
}

const DEFAULT_QUALITY = 82

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'static', 'img')

async function render(spec: ImageSpec) {
  const input = sharp(join(imgDir, spec.src))
  const pipeline = await (async () => {
    if (!spec.band && !spec.xband) {
      return input
    }
    const { height, width } = await input.metadata()
    const [top, bottom] = spec.band ?? [0, 1]
    const [left, right] = spec.xband ?? [0, 1]
    return input.extract({
      left: Math.round(left * width),
      top: Math.round(top * height),
      width: Math.round((right - left) * width),
      height: Math.round((bottom - top) * height),
    })
  })()
  return pipeline
    .resize(spec.width, spec.height, {
      fit: spec.pad ? 'contain' : 'cover',
      position: 'top',
      background: spec.pad,
    })
    .webp({ quality: spec.quality ?? DEFAULT_QUALITY })
    .toBuffer()
}

// Every output has to be one the store knows to skip, or it becomes a figure
// with a lock line — and a lock line for something computed is the staleness
// this arrangement exists to remove. A new DERIVED key is the case that reaches
// here: it writes a loose name beside its own source, where the exclusion is a
// list rather than a directory.
async function emit(label: string, out: string, spec: ImageSpec) {
  const rel = relative(imgDir, out)
  if (!isDerivedFigure(rel, 'website/static/img')) {
    throw new Error(
      `${rel} is not named as derived — add it to derivedFigureFiles in figure-store.ts, or write it under one of the derived directories`,
    )
  }
  const next = await render(spec)
  const prev = await readFile(out).catch(() => undefined)
  if (prev?.equals(next)) {
    console.log(`≈ ${label} (unchanged)`)
    return
  }
  await writeFile(out, next)
  console.log(`✓ ${label} (${prev ? 'updated' : 'created'})`)
}

await emit('screenshot', join(imgDir, 'screenshot.webp'), HERO)

for (const [key, spec] of Object.entries(DERIVED)) {
  await emit(key, join(imgDir, `${key}.webp`), spec)
}

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

// Regenerates the homepage hero (static/img/screenshot.webp) and the gallery
// preview thumbs (static/img/home-gallery/<key>.webp) from committed figure
// PNGs, so the homepage can't drift from the app the way a hand-made capture
// does — the previous hero was a Hi-C shot from 2024 whose alt text described a
// different view entirely.
//
// The thumbs render ~324x150 in the card, so a full-window capture spends most
// of the card on menu bar, header and ruler. `band` frames the data rows
// instead; fractions, not pixels, so a re-rendered figure of the same layout
// stays framed. The hero keeps its chrome — the whole point of that image is
// that it looks like an application.
//
// `--check` fails if an output is stale, mirroring gen:tutorial-thumbs.

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
  // Output size. Omit height to scale the framed region to width.
  width: number
  height?: number
  quality?: number
}

const HERO: ImageSpec = {
  src: 'sv_cgiab/deletion_linear_view.png',
  width: 1400,
}

// Card aspect is ~2.16:1 at the 4-up desktop layout.
const THUMB_WIDTH = 700
const THUMB_HEIGHT = 324

const THUMBS: Record<string, ImageSpec> = {
  synteny: {
    src: 'linear_synteny_gallery.png',
    band: [0.26, 0.72],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  // Split view + read arcs across a breakend — the most JBrowse-specific SV
  // visual, and it doesn't repeat the blue matrix of the copy-number card.
  sv: {
    src: 'breakpoint_split_view.png',
    band: [0.3, 0.88],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  alignments: {
    src: 'gallery/nanopore_methylation.png',
    band: [0.42, 1],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  variants: {
    src: 'gwas/locuszoom_ld.png',
    band: [0.26, 0.86],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  hic: {
    src: 'hic_track.png',
    band: [0.26, 1],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  copynumber: {
    src: 'gallery/copynumber_clustered.png',
    band: [0.36, 1],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  genes: {
    src: 'gallery/sarscov2_polyprotein.png',
    band: [0.38, 0.88],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  // Two-panel figure — the 3D structure is the right-hand panel.
  protein: {
    src: 'protein/connected.png',
    band: [0.55, 1],
    xband: [0.5, 0.96],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
}

const DEFAULT_QUALITY = 82

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'static', 'img')
const thumbDir = join(imgDir, 'home-gallery')

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
    .resize(spec.width, spec.height, { fit: 'cover', position: 'top' })
    .webp({ quality: spec.quality ?? DEFAULT_QUALITY })
    .toBuffer()
}

const check = process.argv.includes('--check')
let stale = 0

async function emit(label: string, out: string, spec: ImageSpec) {
  const next = await render(spec)
  const prev = await readFile(out).catch(() => undefined)
  if (prev?.equals(next)) {
    console.log(`≈ ${label} (unchanged)`)
    return
  }
  if (check) {
    console.error(`✗ ${label} is stale — run \`pnpm gen:home-images\``)
    stale++
    return
  }
  await writeFile(out, next)
  console.log(`✓ ${label} (${prev ? 'updated' : 'created'})`)
}

await emit('screenshot', join(imgDir, 'screenshot.webp'), HERO)

for (const [key, spec] of Object.entries(THUMBS)) {
  await emit(key, join(thumbDir, `${key}.webp`), spec)
}

const managed = new Set(Object.keys(THUMBS).map(key => `${key}.webp`))
for (const file of await readdir(thumbDir)) {
  if (file.endsWith('.webp') && !managed.has(file)) {
    console.log(`· ${file} (unmanaged — add a spec to manage it)`)
  }
}

if (stale > 0) {
  process.exit(1)
}

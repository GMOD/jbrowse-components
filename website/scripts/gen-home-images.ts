import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { isDerivedFigure } from './figure-store.ts'

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
// Output is gitignored and excluded from the figure store, and `dev`, `build`
// and `index` regenerate it — the same arrangement, for the same reason, as
// gen-tutorial-thumbs.ts and gen-gallery-thumbs.ts.

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

// Card aspect is ~2.16:1 at the 4-up desktop layout.
const THUMB_WIDTH = 700
const THUMB_HEIGHT = 324

const THUMBS: Record<string, ImageSpec> = {
  // The whole comparative view, not just the ribbon band: a band narrower than
  // the card aspect gets center-cropped left/right by the `cover` resize, which
  // threw away half the ribbon fan and read as a zoomed-in smear.
  synteny: {
    src: 'mcscan_anchors.png',
    band: [0.055, 0.925],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  // Split view + read arcs across a breakend — the most JBrowse-specific SV
  // visual, and it doesn't repeat the blue matrix of the copy-number card.
  sv: {
    src: 'breakpoint_split_view.png',
    // Both panels of the split view, from the top panel's ruler down to the
    // bottom one's border: the arcs only tell their story if the two loci they
    // connect are both in frame. Stops at 0.775 — the source has page
    // background below the view, and letting the band run to 1 spent a quarter
    // of the card on it.
    band: [0.12, 0.775],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  alignments: {
    src: 'gallery/nanopore_methylation.png',
    band: [0.42, 1],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  // Down to the gene track rather than stopping mid-Manhattan: a band shorter
  // than the card aspect gets center-cropped left/right, and at [0.26, 0.86]
  // that kept under half the width, cutting the shoulders off the peak.
  variants: {
    src: 'gwas/locuszoom_ld.png',
    band: [0.28, 1],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  hic: {
    src: 'hic_track.png',
    // Tall enough that the band is wider than the card aspect, so nothing is
    // cropped left/right and the whole contact triangle fits — at [0.26, 1] it
    // was cropped to 85% of the width and the triangle's lower half fell off
    // the bottom. The source has no whitespace-free framing that also keeps
    // full width, so the strip below the view border is the deliberate cost.
    band: [0.1, 1],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  copynumber: {
    src: 'gallery/copynumber_clustered.png',
    band: [0.36, 1],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  // Bottom (post-collapse) frame of the two-stage figure, framed on the exons
  // themselves: PTEN's nine exons side by side with the region boundaries and
  // the sashimi arcs spanning between them. Stops short of the "Introns
  // collapsed" snackbar, which reads as a cut-off chip at card size.
  genes: {
    src: 'gene_track_collapse_introns.png',
    band: [0.645, 0.925],
    xband: [0, 0.39],
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
  // Two-panel figure — the 3D structure is the right-hand panel. The band is
  // the molecule rather than the whole molstar canvas, and both edges matter:
  // the canvas's bottom is inside the frame rather than at it, so a band
  // reaching the source's last row takes the window border with it, and the
  // region is height-constrained against this card's aspect, so every row of
  // empty canvas the band keeps is scaled off the molecule. It still pads left
  // and right onto the canvas background rather than cropping — cover would
  // zoom back in past the tails.
  protein: {
    src: 'protein/connected.png',
    band: [0.5, 0.93],
    xband: [0.512, 0.945],
    pad: '#fcfbf9',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  },
}

const DEFAULT_QUALITY = 82

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'static', 'img')
// Created here rather than assumed — see the same line in gen-tutorial-thumbs.
const thumbDir = join(imgDir, 'home-gallery')
await mkdir(thumbDir, { recursive: true })

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

for (const [key, spec] of Object.entries(THUMBS)) {
  await emit(key, join(thumbDir, `${key}.webp`), spec)
}

const managed = new Set(Object.keys(THUMBS).map(key => `${key}.webp`))
for (const file of await readdir(thumbDir)) {
  if (file.endsWith('.webp') && !managed.has(file)) {
    console.log(`· ${file} (unmanaged — add a spec to manage it)`)
  }
}

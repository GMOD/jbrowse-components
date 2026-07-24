import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

// Regenerates the tutorial landing-page card thumbnails
// (static/img/tutorial-thumbs/<key>.webp) from the same figure PNGs the
// tutorials themselves show, so a card can't drift from its tutorial. Each card
// is a 5:3 cover-crop; frame a figure with `band`/`position` when a plain
// top-crop isn't the flattering part. Prefer a clean render as the source — the
// card is a gallery surface, so avoid figures carrying hand-added callout paint.
//
// Only keys listed here are managed: the script regenerates exactly these and
// leaves any other on-disk thumb alone (reported as unmanaged). `--check` fails
// if a managed thumb is stale, mirroring gen:gallery-links-check.

interface ThumbSpec {
  // Source figure under static/img (the PNG the tutorial embeds).
  src: string
  // Vertical slice of the source to frame, as [top, bottom] fractions of its
  // height (full width kept). Omit to cover-crop the whole figure. Fractions,
  // not pixels, so a re-rendered figure of the same layout stays framed.
  band?: [number, number]
  // Horizontal slice, as [left, right] fractions of width (full height kept).
  // Use to frame a clean column of a wide figure, e.g. past a label gutter or a
  // baked-in region marker. Composes with `band`.
  xband?: [number, number]
  // Cover-crop anchor when the framed region isn't already 5:3. 'top' keeps the
  // header, 'left' keeps row labels. Default 'top'.
  position?: 'top' | 'left' | 'center'
  quality?: number
}

const THUMB_SPECS: Record<string, ThumbSpec> = {
  analyze_trio: {
    src: 'trio-matrix-phased-clean.png',
    band: [0.25, 0.5875],
    position: 'left',
  },
  genomes_synteny: {
    src: 'synteny_hg38_hs1_tnnt3.png',
    // the two gene panels and the strand-colored ribbons between them, without
    // the app header
    band: [0.28, 0.95],
  },
  // The 464-haplotype clustered genotype matrix with its dendrogram: the
  // population-scale figure that best reads as "pangenome" on a card. Skip the
  // app header; keep the left edge so the dendrogram stays in frame.
  pangenome_hprc: {
    src: 'hprc2/mhc_clustered.png',
    band: [0.24, 1],
    position: 'left',
  },
  // The Minigraph-Cactus pangenome-variant matrix on K12 (teal/red/yellow
  // genotype blocks). A clean render, unlike the odgi viz raster's baked-in
  // region markers; it echoes the ecoli card on purpose, since the two
  // tutorials build the same four-strain demo two ways. Frame the matrix,
  // dropping the app header and gene lane.
  pangenome_cactus: {
    src: 'pangenome_cactus/variant_matrix.png',
    band: [0.48, 0.66],
  },
  // The genome-wide TCGA-BRCA CNV cohort matrix. The lower half carries
  // hand-added gene callouts, so frame the clean heatmap band above them.
  tcga_cohort_cnv: {
    src: 'tcga/cohort_cnv_genome.png',
    band: [0.14, 0.56],
    position: 'center',
  },
  // Overlaid multi-wiggle coverage, the most figure-like of the cookbook
  // recipes. Skip the app header and its navigation row.
  cookbook: {
    src: 'cookbook_multiwig.png',
    band: [0.24, 1],
  },
}

const WIDTH = 600
const HEIGHT = 360
const DEFAULT_QUALITY = 82

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'static', 'img')
const thumbDir = join(imgDir, 'tutorial-thumbs')

async function render(spec: ThumbSpec) {
  const input = sharp(join(imgDir, spec.src))
  const pipeline =
    spec.band || spec.xband
      ? await (async () => {
          const { height, width } = await input.metadata()
          const [t, b] = spec.band ?? [0, 1]
          const [l, r] = spec.xband ?? [0, 1]
          const top = Math.round(t * height)
          const left = Math.round(l * width)
          return input.extract({
            left,
            top,
            width: Math.round(r * width) - left,
            height: Math.round(b * height) - top,
          })
        })()
      : input
  return pipeline
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: spec.position ?? 'top' })
    .webp({ quality: spec.quality ?? DEFAULT_QUALITY })
    .toBuffer()
}

const check = process.argv.includes('--check')
const managed = new Set<string>()
let stale = 0

for (const [key, spec] of Object.entries(THUMB_SPECS)) {
  managed.add(`${key}.webp`)
  const out = join(thumbDir, `${key}.webp`)
  const next = await render(spec)
  const prev = await readFile(out).catch(() => undefined)
  if (prev && prev.equals(next)) {
    console.log(`≈ ${key} (unchanged)`)
    continue
  }
  if (check) {
    console.error(`✗ ${key} is stale — run \`pnpm gen:tutorial-thumbs\``)
    stale++
    continue
  }
  await writeFile(out, next)
  console.log(`✓ ${key} (${prev ? 'updated' : 'created'})`)
}

for (const file of await readdir(thumbDir)) {
  if (file.endsWith('.webp') && !managed.has(file)) {
    console.log(`· ${file} (unmanaged — hand-made, add a spec to manage it)`)
  }
}

if (stale > 0) {
  process.exit(1)
}

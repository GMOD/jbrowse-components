import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { gallerySections, itemImg } from '../src/lib/gallery.ts'
import { isFile, walkFiles } from './check-utils.ts'

// Builds the /gallery/ card thumbnails (static/img/gallery-thumbs/<path>) from
// the committed figures. `pnpm dev`, `pnpm build` and `pnpm index` all run this
// first, so the thumbnails exist wherever the gallery page is rendered; running
// it by hand is only for inspecting the output.
//
// The card is the whole reason this exists: figures are captured at 1500px CSS
// with deviceScaleFactor 2, so they are ~3000px wide, but gallery.astro lays
// them out in a 594px column (1280px `.wide` content, minus 2rem padding either
// side, two tracks and a 1.75rem gap) capped at `max-height: 260px`. A card
// therefore paints at most 594x260 CSS px, and the original carries ~3x more
// pixels in each dimension than even a 2x display can resolve. Serving the
// originals cost 6.72MB across the 42 cards; these thumbnails cost 3.25MB.
//
// The output is **gitignored on purpose**, and generated rather than committed:
// it is 3.4MB derived from files already in the repo, and the figures it
// derives from churn hard (517 revisions in three months), so tracking it would
// add ~160MB/yr of already-compressed, undeltifiable binary history to a 1.4GB
// .git — against 15s of build time, once, cold. Not committing it also removes
// the whole staleness failure mode: there is no committed copy to disagree with
// a regenerated figure, so no `--check` and no rule to remember after running
// generate-screenshots.ts.
//
// Format stays PNG rather than moving to WebP. These captures are flat-color UI
// art already quantized to an 8-bit palette by the capture pipeline's pngquant
// pass (image-pipeline.ts), which is the worst case for lossy VP8: 256 hard
// palette colors plus 4:2:0 chroma subsampling costs *more* bits than the
// palette PNG spends, and it smears text. Lossless WebP does win (~28%), but
// only by adding a second format, a browser-support caveat, and VP8L header
// parsing to the intrinsic-size read in gallery.astro — for a fraction of what
// resizing already saves.

// The card's own maximum painted size (see above) times 2, so every thumbnail
// is still retina-sharp: with the height cap binding, that is 600/260 = 2.3
// device px per CSS px, and for a figure wide enough to be width-capped instead
// it is 1200/594 = 2.0. Dropping to a 1000x500 box takes the height-capped case
// to 1.9 — below retina, and visibly softer on the gene-track labels.
const BOX = { width: 1200, height: 600 }

// `colours: 256` is a real constraint, not a default worth relaxing. These
// figures encode data in color (strand, genotype, methylation), and a 128-color
// palette does not merely soften them — it drops the gene track's orange and
// remaps the glyphs to red, which misreads as a different strand. At 256 the
// mean channel error against the unquantized resize is 0.58/255. `dither: 0`
// matches the capture pipeline's `--nofs`, for the same reason it uses it:
// error-diffusion noise on flat UI chrome is pure entropy that inflates the
// file for no visible gain.
const PNG = { palette: true, quality: 80, colours: 256, effort: 10, dither: 0 }

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'static', 'img')
const thumbDir = join(imgDir, 'gallery-thumbs')

// The figures the gallery actually paints as cards — derived from gallery.ts
// rather than listed here, so adding a card can't leave its thumbnail behind.
// Mirrors the `cards` filter in gallery.astro.
const files = gallerySections
  .flatMap(s => s.items)
  .flatMap(item => {
    const file = itemImg(item)
    return file ? [file] : []
  })

const managed = new Set(files)
let missing = 0
let built = 0

// So the sweep below can read it on a checkout that has never generated thumbs.
mkdirSync(thumbDir, { recursive: true })

for (const file of files) {
  const src = join(imgDir, file)
  if (isFile(src)) {
    const out = join(thumbDir, file)
    // Rebuild only when the figure is newer than its thumbnail. A regen of all
    // 42 is 15s, which every `pnpm dev` would otherwise pay; this makes the
    // warm case free, and a fresh clone's checkout mtimes just build it once.
    const fresh = isFile(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs
    if (!fresh) {
      const png = await sharp(src)
        .resize({ ...BOX, fit: 'inside', withoutEnlargement: true })
        .png(PNG)
        .toBuffer()
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, png)
      built++
    }
  } else {
    // gallery.astro would fail its own thumbnail read on this, but that is a
    // build-time crash with no name attached; say which item is wrong.
    console.error(
      `✗ ${file} is referenced by a gallery item but not in static/img`,
    )
    missing++
  }
}

// A thumbnail whose figure left the gallery is pure dead weight.
let removed = 0
for (const path of walkFiles(thumbDir, name => name.endsWith('.png'))) {
  if (!managed.has(relative(thumbDir, path))) {
    rmSync(path)
    removed++
  }
}

console.log(
  `gallery thumbs: ${files.length - missing} cards, ${built} built, ${removed} removed`,
)

if (missing > 0) {
  process.exit(1)
}

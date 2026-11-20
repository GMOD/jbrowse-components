import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { TUTORIAL_NO_THUMB } from '../src/lib/guide-categories.ts'
import {
  GUIDE_THUMB_OVERRIDES,
  type ThumbSpec,
  guideThumbSpec,
} from '../src/lib/guide-thumbs.ts'
import { TUTORIAL_THUMB_SPECS } from '../src/lib/tutorial-thumbs.ts'

// Regenerates the tutorial landing-page card thumbnails
// (static/img/tutorial-thumbs/<key>.webp) from the same figure PNGs the
// tutorials themselves show, so a card can't drift from its tutorial. Each card
// is a 5:3 cover-crop; frame a figure with `band`/`position` when a plain
// top-crop isn't the flattering part. Prefer a clean render as the source — the
// card is a showcase surface, so avoid figures carrying hand-added callout paint.
//
// Every card is managed in src/lib/tutorial-thumbs.ts — there are no hand-made
// thumbs left. The ones
// this replaced were full-window captures scaled to card size, which read as
// unlegible app chrome, and one (pangenome_ecoli) was of a window no spec
// renders any more, so nothing could regenerate it. A tutorial with no figure to
// derive from gets the chromeless card instead (NO_THUMB in
// docs/tutorials/index.astro), not a stand-in image.
//
// The script regenerates exactly the keys listed there and leaves any other
// on-disk thumb alone (reported as unmanaged). `dev`, `build` and `index` run
// it, and the output is gitignored and excluded from the figure store, so a
// card is recomputed from whatever its source figure currently is and there is
// no second copy to drift. It used to be stored with a `--check` gate instead,
// and figures churn hard enough that the gate reddened main on three separate
// pushes in one day — see isDerivedFigure in figure-store.ts.
//
// What this script still fails on is structural and cannot be recomputed: a
// spec whose page was renamed, a tutorial with no card, a spec naming a source
// figure that does not exist.

const WIDTH = 600
const HEIGHT = 360
const DEMO_WIDTH = 1200
const DEFAULT_QUALITY = 82

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'static', 'img')
// Created here rather than assumed: nothing installs this directory any more.
// `figures:pull` used to, as a side effect of writing thumbs into it, and that
// is the one thing a fresh clone would otherwise have to have done first.
const thumbDir = join(imgDir, 'tutorial-thumbs')
await mkdir(thumbDir, { recursive: true })

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

const managed = new Set<string>()

// A key here is a card key, and nothing downstream says so: index.astro looks a
// thumb up BY key, so a spec whose page moved or was renamed keeps rendering a
// webp no card ever requests. `pangenome_graph_view` did exactly that after the
// page became user_guides/graph_genome_view.md, and every run kept reporting it
// as a managed thumb. Fail on it instead.
//
// A key is `docs/tutorials/<key>.md`, or `docs/<key>.md` for the handful of
// root-level pages index.astro pulls onto the page (EXTRA_DOCS: the quickstarts
// and the cookbook). Derived rather than listed, so adding one there needs no
// edit here.
const docsDir = join(here, '..', 'docs')
const mdSlugs = async (dir: string) =>
  (await readdir(dir))
    .filter(f => f.endsWith('.md') && f !== 'CLAUDE.md')
    .map(f => f.replace(/\.md$/, ''))
const slugs = new Set([
  ...(await mdSlugs(join(docsDir, 'tutorials'))),
  ...(await mdSlugs(docsDir)),
])
// Both directions are collected before either is reported: they are two halves
// of one mismatch, and a page rename produces one of each — so exiting on the
// orphan meant fixing it, re-running, and only then being told about the card
// with no thumb behind it.
const problems: string[] = []

const orphans = Object.keys(TUTORIAL_THUMB_SPECS).filter(k => !slugs.has(k))
if (orphans.length > 0) {
  problems.push(
    `✗ no docs/tutorials page for: ${orphans.join(', ')} — drop the spec (and its webp), or point it at the page's new slug`,
  )
}

// And the other direction. index.astro renders an <img> for every card key it
// does not find in TUTORIAL_NO_THUMB, so a tutorial page with no spec here isn't
// a missing card — it is a card pointing at a webp that does not exist, which
// nothing reported until the website link checker found the 404 on a built site.
// Only tutorials/ is checked: the root-level pages index.astro also pulls onto
// the landing page (EXTRA_DOCS) are a hand-picked few among all of docs/, so the
// slug list alone can't tell which of those are cards.
const uncarded = (await mdSlugs(join(docsDir, 'tutorials'))).filter(
  s => !(s in TUTORIAL_THUMB_SPECS) && !TUTORIAL_NO_THUMB.has(s),
)
if (uncarded.length > 0) {
  problems.push(
    `✗ no thumbnail spec for: ${uncarded.join(', ')} — add one pointing at a figure the page embeds, or add the slug to TUTORIAL_NO_THUMB for the chromeless card`,
  )
}

const guideSlugs = new Set(await mdSlugs(join(docsDir, 'user_guides')))
const guideOrphans = Object.keys(GUIDE_THUMB_OVERRIDES).filter(
  k => !guideSlugs.has(k),
)
if (guideOrphans.length > 0) {
  problems.push(
    `✗ no docs/user_guides page for GUIDE_THUMB_OVERRIDES: ${guideOrphans.join(', ')}`,
  )
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}

async function renderWhole(spec: ThumbSpec) {
  return sharp(join(imgDir, spec.src))
    .resize({ width: DEMO_WIDTH, withoutEnlargement: true })
    .webp({ quality: DEFAULT_QUALITY })
    .toBuffer()
}

async function writeThumbs(
  dir: string,
  specs: [string, ThumbSpec][],
  managed: Set<string>,
  draw = render,
) {
  for (const [key, spec] of specs) {
    managed.add(`${key}.webp`)
    const out = join(dir, `${key}.webp`)
    const next = await draw(spec)
    const prev = await readFile(out).catch(() => undefined)
    if (prev && prev.equals(next)) {
      console.log(`≈ ${key} (unchanged)`)
      continue
    }
    await writeFile(out, next)
    console.log(`✓ ${key} (${prev ? 'updated' : 'created'})`)
  }
  for (const file of await readdir(dir)) {
    if (file.endsWith('.webp') && !managed.has(file)) {
      console.log(`· ${file} (unmanaged — hand-made, add a spec to manage it)`)
    }
  }
}

await writeThumbs(thumbDir, Object.entries(TUTORIAL_THUMB_SPECS), managed)

const demoDir = join(imgDir, 'demo-figures')
await mkdir(demoDir, { recursive: true })
await writeThumbs(
  demoDir,
  Object.entries(TUTORIAL_THUMB_SPECS),
  new Set(),
  renderWhole,
)

const guideDir = join(imgDir, 'guide-thumbs')
await mkdir(guideDir, { recursive: true })
const guideSpecs: [string, ThumbSpec][] = []
for (const slug of guideSlugs) {
  const body = await readFile(
    join(docsDir, 'user_guides', `${slug}.md`),
    'utf8',
  )
  const spec = guideThumbSpec(slug, body)
  if (spec) {
    guideSpecs.push([slug, spec])
  }
}
await writeThumbs(guideDir, guideSpecs, new Set())

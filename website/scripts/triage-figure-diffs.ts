// Which changed figures moved only because everything slid vertically, and
// which ones actually redrew.
//
// The question this exists for: a global layout change rewrites most of the
// corpus at once. `trackLabelOffset`'s marginBottom going 4 -> 8 (e103ce2ca9)
// rewrote 210 of 346 captures — every track's content 4 css px lower, and the
// shift ACCUMULATES down a stack, so a two-track figure moves 8. Nothing about
// that needs a reviewer's eye, but it invalidates every verdict it touches
// (the review report stamps a verdict with the sha1 of the pixels it was made
// against), and it is indistinguishable at the manifest level from a figure
// that also lost a track.
//
// So: align each figure to its baseline row by row, allowing each row its own
// vertical offset, and rank the corpus by how much of its difference that
// accounts for. The tail — figures at 99% and up — is the part with nothing to
// look at, and on the sweep this was written for that tail is 89 of 209.
//
// Deliberately not a pixel diff. `pngDiffFraction` answers "how many pixels
// differ", which for a 4px slide of text-heavy content is 6-11% — the same
// number a real change scores, because both are dominated by the antialiased
// edges of every glyph. The two are only separable by asking whether the same
// content is present somewhere else.
//
//   node scripts/triage-figure-diffs.ts --base 6a27387de3^
//
// The --base default is origin/main, matching the review UI. Name an older ref
// once the baseline has moved past the change you are triaging: publishing the
// regen is what makes origin/main agree with your disk, and this then has
// nothing to compare.
//
// WHAT IT DOES NOT SEPARATE. A slide is not the only thing a layout change
// causes: a display that fits its rows to the available height RE-PACKS when
// that height moves, so its rows land at slightly different heights and no
// single offset explains them. sequence_track (re-packed sequence rows) scores
// 75% and dotplot_add (a genuinely re-laid-out dialog) scores 84%, so the top of
// the ranking is not strictly "redrew first". Treat the ranking as an ordering
// to read down, not a verdict — the number this tool can be trusted on is the
// one at the bottom, where a figure that only moved says so plainly.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import sharp from 'sharp'

import {
  fetchBlob,
  manifestAt,
  readManifest,
  repoRoot,
} from './figure-paths.ts'
import { type FigureEntry, figureName } from './figure-store.ts'
import { matchesFilterTokens, parseFilterTokens } from './filter-tokens.ts'

// Not imported from screenshot-options.ts, which is where it is defined and
// explained: importing that module parses process.argv strictly, so it rejects
// this script's own flags before main ever runs. Its header says so. Captures
// are hidpi, so an image pixel is half a css pixel, and this is only ever used
// to phrase the second number.
const DEVICE_SCALE_FACTOR = 2

const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    base: { type: 'string', default: 'origin/main' },
    filter: { type: 'string', multiple: true },
    exact: { type: 'boolean', default: false },
    tolerance: { type: 'string' },
    'max-shift': { type: 'string' },
    concurrency: { type: 'string' },
    json: { type: 'string' },
    verbose: { type: 'boolean', default: false },
  },
})

// Mean absolute grey difference, 0-255, under which a row counts as matched.
// Not zero: a row either side of something that moved still carries the
// antialiased fringes of glyphs that landed on a different subpixel, and those
// are what a reviewer is explicitly NOT being asked to look at. Only the
// reported y ranges depend on this — the ranking is a ratio of distances and
// does not consult it.
const DEFAULT_TOLERANCE = 4

// The largest slide worth looking for, in image px. 64 is 32 css px at DPR 2,
// i.e. eight tracks' worth of the 4px label margin. Content that moved further
// than this did not slide in any sense a reader would recognise, and leaving it
// unexplained is the honest answer.
const DEFAULT_MAX_SHIFT = 64

const DEFAULT_CONCURRENCY = 6

// Columns each row is reduced to before comparing. The point is a row
// SIGNATURE, not the row: 192 averaged columns keep every element boundary a
// reviewer could see while making the search 10-15x cheaper than full width,
// and the averaging is itself a denoiser for single-pixel glyph fringes.
const SIGNATURE_WIDTH = 192

// Rows averaged together before comparing. 2 takes the edge off single-pixel
// re-rasterization without blurring away the thing being measured: at 4 an 8px
// slide stops mattering to the comparison at all, and a figure whose dialog was
// re-laid out scored as well as one that only slid.
const ROW_SCALE = 2

// Grey levels a row must already differ by, unaligned, to be counted at all.
//
// The ratio this script ranks on is "of the difference that exists, how much
// does the slide explain", and rows with no difference to explain are not part
// of that question. They are also most of the figure — a slide is invisible in
// the middle of a solid band, since one row of a uniform colour is
// interchangeable with the row 8px above it. Counting them put ~0 in both
// halves of the ratio and every figure scored 100%.
const DIFFERING_FLOOR = 1

// Grey levels between a row's lightest and darkest sample, below which the row
// is not evidence about anything.
//
// A blank row matches every other blank row at every offset with a distance of
// exactly zero, so counting them buries the signal twice over: they vote for
// whatever offset the search happens to try first (the extreme of the window,
// which read as a corpus-wide "+64px slide"), and they drag both halves of the
// explained ratio to zero, which printed "100% explained, 0.0 left" for a
// figure whose dialog had visibly moved. Roughly half of a typical capture is
// background.
const CONTENT_CONTRAST = 12

// Unexplained rows closer together than this are reported as one range. A
// redrawn element leaves a band of unexplained rows with the odd matching row
// inside it (a blank line between two rows of text matches anything), and
// listing those as separate ranges turns one finding into fifteen.
const RANGE_GAP = 8

// Figures printed without --verbose. The tail of the ranking is by construction
// the part that only slid, so cutting it is cutting the part with nothing to
// say — and the count of what was cut is still printed.
const LISTED = 40

if (values.help) {
  console.log(`Triage what a corpus-wide figure diff actually is.

Usage: node scripts/triage-figure-diffs.ts [options]

  --base <ref>        manifest to compare against (default origin/main). Once a
                      regen is published, origin/main IS your disk — name the
                      commit before the push, e.g. --base <sha>^
  --filter a,b        only these figures (substring on the figure name)
  --exact             --filter matches whole names
  --tolerance <n>     mean grey levels, 0-255, under which a band counts as
                      matched (default ${DEFAULT_TOLERANCE})
  --max-shift <px>    largest vertical offset to look for, in image px
                      (default ${DEFAULT_MAX_SHIFT})
  --concurrency <n>   figures in flight (default ${DEFAULT_CONCURRENCY})
  --json <file>       also write the full per-figure result
  --verbose           list every figure, not just the ${LISTED} least explained

Figures are RANKED by how much of their difference a vertical slide accounts
for, least first — so the ones that redrew sort to the top and the ones that
only moved sort to the bottom. Read down until the entries stop being
interesting. Figures whose canvas resized, or that have no baseline, are listed
separately: neither can be aligned.
`)
  process.exit(0)
}

const tolerance = Number(values.tolerance ?? DEFAULT_TOLERANCE)
const maxShift = Number(values['max-shift'] ?? DEFAULT_MAX_SHIFT)
const concurrency = Number(values.concurrency ?? DEFAULT_CONCURRENCY)
const tokens = parseFilterTokens(values.filter)

interface RowImage {
  // the figure's own dimensions, for the resize check and for reporting
  width: number
  height: number
  // rows in the signature, i.e. ceil(height / ROW_SCALE)
  rows: number
  // rows * SIGNATURE_WIDTH grey samples, row-major
  data: Uint8Array
}

// The figure reduced to a fixed-width, ROW_SCALE-averaged grey signature, in
// one native call. `fit: 'fill'` because both axes are being set independently
// — aspect ratio is not a thing this wants preserved.
async function rowSignature(input: Buffer | string): Promise<RowImage> {
  const { width, height } = await sharp(input).metadata()
  if (!height || !width) {
    throw new Error('no dimensions')
  }
  const rows = Math.max(1, Math.round(height / ROW_SCALE))
  const { data, info } = await sharp(input)
    // an alpha channel would otherwise premultiply into the grey and read as
    // content; figures are opaque, but a hand-made diagram need not be
    .flatten({ background: '#ffffff' })
    .grayscale()
    .resize({ width: SIGNATURE_WIDTH, height: rows, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = info.channels
  if (channels === 1) {
    return {
      width,
      height,
      rows,
      data: new Uint8Array(data.buffer, data.byteOffset, data.length),
    }
  }
  // grayscale() should give one channel; if a colour profile keeps three, take
  // the first rather than failing
  const out = new Uint8Array(SIGNATURE_WIDTH * rows)
  for (let i = 0; i < out.length; i++) {
    out[i] = data[i * channels]!
  }
  return { width, height, rows, data: out }
}

// Mean absolute difference, 0-255, between row `ay` of a and row `by` of b —
// where `by` may be a HALF pixel, in which case the baseline row it is compared
// against is the average of the two rows either side.
//
// Half pixels are not a refinement, they are the difference between this tool
// working and not. Two things in a re-laid-out capture land between rows.
// Displays that fit their rows to the available height re-pack when that height
// changes by 4px, so a row lands 7.5px down rather than 8; and every gradient
// inside a container that grew is re-interpolated, so the 8px fade under a
// track holds levels the baseline never had. On integer offsets only, both read
// as content that matches nothing — sequence_track came out REDREW on 100+ rows
// of re-packed sequence and shadow gradient with nothing drawn differently in
// any of them, which is precisely the false alarm this tool exists to remove.
function rowDistance(a: RowImage, ay: number, b: RowImage, by: number): number {
  const ao = ay * SIGNATURE_WIDTH
  const lo = Math.floor(by)
  const bo = lo * SIGNATURE_WIDTH
  const half = by !== lo
  const bo2 = bo + (half ? SIGNATURE_WIDTH : 0)
  let sum = 0
  for (let x = 0; x < SIGNATURE_WIDTH; x++) {
    const bv = (b.data[bo + x]! + b.data[bo2 + x]!) / 2
    const d = a.data[ao + x]! - bv
    sum += Math.abs(d)
  }
  return sum / SIGNATURE_WIDTH
}

// Where row `y` of the new image is found in the baseline, and how well.
//
// Every row searches the whole window on its own rather than choosing from a
// short list of figure-wide offsets, which is what this did first. The short
// list is wrong for the case it most needs to get right: a display that fits
// its rows to the available height re-packs when that height changes, so a
// track whose content moved 8px does NOT move every row by 8 — the rows either
// side of it land 6, 7 and 9 px down as the fractional row height rounds
// differently. Pinned to a figure-wide 8, all of those read as unexplained and
// sequence_track came out REDREW at 14.5%, which is exactly the false alarm
// this tool exists to remove.
//
// It is also fast enough not to need the shortcut: 129 offsets x 192 columns x
// the row count is ~47M byte comparisons for a tall figure, tens of ms.
function rowContrast(img: RowImage, y: number): number {
  const o = y * SIGNATURE_WIDTH
  let lo = 255
  let hi = 0
  for (let x = 0; x < SIGNATURE_WIDTH; x++) {
    const v = img.data[o + x]!
    if (v < lo) {
      lo = v
    }
    if (v > hi) {
      hi = v
    }
  }
  return hi - lo
}

function alignRow(now: RowImage, base: RowImage, y: number) {
  let best = Infinity
  let bestDy = 0
  // the search runs in signature rows; maxShift is stated in image px because
  // that is the unit the change being triaged is described in
  const limit = maxShift / ROW_SCALE
  for (let dy = -limit; dy <= limit; dy += 0.5) {
    const by = y + dy
    // a half offset reads the row below too, so it needs one row of headroom
    if (by < 0 || by >= base.rows - 1) {
      continue
    }
    const d = rowDistance(now, y, base, by)
    if (d < best) {
      best = d
      bestDy = dy
      if (d === 0) {
        break
      }
    }
  }
  return { distance: best, dy: bestDy * ROW_SCALE }
}

interface Unexplained {
  from: number
  to: number
  peak: number
}

interface Triage {
  name: string
  verdict: 'compared' | 'resized' | 'added' | 'error'
  // 0..1, how much of this figure's difference a vertical slide accounts for.
  // 1 is "the picture only moved"; 0 is "correcting the slide changed nothing,
  // so it redrew". The list is ranked on this.
  explained: number
  // mean per-row difference before and after the slide is corrected, in grey
  // levels. Printed because `explained` is a ratio and a ratio of two tiny
  // numbers is noise — `aligned` is what says whether there is anything left.
  raw: number
  aligned: number
  // px of vertical slide -> how many rows took it
  offsets: [number, number][]
  rows: number
  unexplainedRows: number
  ranges: Unexplained[]
  note?: string
}

function summariseOffsets(counts: Map<number, number>): [number, number][] {
  return [...counts]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
}

function mergeRanges(rows: { y: number; d: number }[]): Unexplained[] {
  const out: Unexplained[] = []
  for (const { y, d } of rows) {
    const last = out.at(-1)
    if (last && y - last.to <= RANGE_GAP) {
      last.to = y
      last.peak = Math.max(last.peak, d)
    } else {
      out.push({ from: y, to: y, peak: d })
    }
  }
  return out
}

async function triage(path: string, baseEntry: FigureEntry): Promise<Triage> {
  const name = figureName(path)
  const blank: Triage = {
    name,
    verdict: 'error',
    explained: 0,
    raw: 0,
    aligned: 0,
    offsets: [],
    rows: 0,
    unexplainedRows: 0,
    ranges: [],
  }
  let now: RowImage
  let base: RowImage
  try {
    ;[now, base] = await Promise.all([
      rowSignature(join(repoRoot, path)),
      fetchBlob(baseEntry).then(rowSignature),
    ])
  } catch (err) {
    return { ...blank, note: `${err instanceof Error ? err.message : err}` }
  }
  if (now.width !== base.width || now.height !== base.height) {
    return {
      ...blank,
      verdict: 'resized',
      note: `${base.width}x${base.height} -> ${now.width}x${now.height}`,
    }
  }
  const counts = new Map<number, number>()
  const bad: { y: number; d: number }[] = []
  let rawSum = 0
  let alignedSum = 0
  let content = 0
  for (let y = 0; y < now.rows; y++) {
    // Background rows are skipped outright rather than counted as matches: see
    // CONTENT_CONTRAST. They are not evidence, and treating them as agreement
    // is how a figure with a moved dialog scored a perfect explanation.
    if (
      rowContrast(now, y) < CONTENT_CONTRAST &&
      rowContrast(base, y) < CONTENT_CONTRAST
    ) {
      continue
    }
    const rawHere = rowDistance(now, y, base, y)
    if (rawHere < DIFFERING_FLOOR) {
      continue
    }
    content++
    const { distance, dy } = alignRow(now, base, y)
    rawSum += rawHere
    alignedSum += distance
    if (distance <= tolerance) {
      // reported as the slide a reader would describe: content moved DOWN by
      // this many px. The search runs the other way (base row = y + dy), and
      // printing that sign would have every figure in this corpus sliding
      // "up" by the margin that was added above it.
      counts.set(-dy, (counts.get(-dy) ?? 0) + 1)
    } else {
      // y ranges are reported in image px, the unit every other figure tool
      // speaks, not in the signature's own rows
      bad.push({ y: y * ROW_SCALE, d: distance })
    }
  }
  const raw = content ? rawSum / content : 0
  const aligned = content ? alignedSum / content : 0
  return {
    name,
    // The ranking key, and the one number here that is worth trusting: how much
    // of this figure's difference the slide accounts for.
    //
    // An absolute residual cannot be compared across figures — a capture of
    // dense per-base glyphs has a noise floor an order of magnitude above a
    // capture of a dialog, so a fixed threshold ranks sequence_track (nothing
    // to see) above dotplot_add (a re-laid-out dialog). Dividing by the same
    // figure's UNALIGNED difference normalises that away: a figure that only
    // slid is largely explained by the slide, one that redrew is not, and both
    // are measured against their own noise.
    explained: raw > 0 ? 1 - aligned / raw : 1,
    raw,
    aligned,
    offsets: summariseOffsets(counts),
    rows: content,
    unexplainedRows: bad.length,
    ranges: mergeRanges(bad),
    verdict: 'compared',
  }
}

// n at a time, in order, so a 200-figure run is not 200 concurrent fetches and
// 200 concurrent decodes.
async function pool<T, R>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = Array.from({ length: items.length })
  let next = 0
  const workers = Array.from(
    { length: Math.min(n, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    },
  )
  await Promise.all(workers)
  return out
}

const describeOffsets = (o: [number, number][]) =>
  o.map(([dy, n]) => `${dy > 0 ? '+' : ''}${dy}px x${n}`).join(', ')

// Every figure whose bytes differ between the baseline manifest and this disk.
// Both halves matter: a figure absent from the baseline has nothing to align
// against, and one absent from disk was never regenerated here.
function selectFigures(base: Map<string, FigureEntry>) {
  const now = readManifest()
  const out: { path: string; base?: FigureEntry }[] = []
  for (const [path, entry] of now) {
    if (!matchesFilterTokens(figureName(path), tokens, values.exact)) {
      continue
    }
    // .svg/.ico carry no raster to align, and imageSize does not size them
    if (!/\.(png|webp|jpe?g)$/i.test(path)) {
      continue
    }
    const before = base.get(path)
    if (!before) {
      out.push({ path })
    } else if (before.sha256 !== entry.sha256) {
      out.push({ path, base: before })
    }
  }
  return out
}

const baseManifest = manifestAt(values.base)
if (!baseManifest) {
  console.error(
    `no figures.lock at ${values.base} — that ref is unknown, or predates the store`,
  )
  process.exit(1)
}

const selected = selectFigures(baseManifest)
if (!selected.length) {
  console.log(
    `Nothing differs from ${values.base}.\n\n` +
      'If you just published a regen, that is why: `figures:push` rewrote ' +
      'figures.lock from your disk, so the baseline and the worktree now agree. ' +
      'Name the commit before the push instead — `--base <sha>^`.',
  )
  process.exit(0)
}

console.log(
  `Comparing ${selected.length} changed figure(s) against ${values.base}…`,
)

const results = await pool(
  selected,
  concurrency,
  async ({ path, base }): Promise<Triage> =>
    base
      ? triage(path, base)
      : {
          name: figureName(path),
          verdict: 'added',
          explained: 0,
          raw: 0,
          aligned: 0,
          offsets: [],
          rows: 0,
          unexplainedRows: 0,
          ranges: [],
        },
)

const by = (v: Triage['verdict']) => results.filter(r => r.verdict === v)
// Ranked, not bucketed. A cutoff between "only slid" and "redrew" would be a
// number invented here, and it could not hold: every figure has its own noise
// floor (a capture of dense per-base glyphs re-rasterizes an order of magnitude
// harder than a capture of a dialog), so the same absolute residual means
// different things on different figures. Ranking sidesteps that — read down
// until the entries stop being interesting, which is a judgement the reviewer
// is in a position to make and this script is not.
const compared = by('compared').sort((a, b) => a.explained - b.explained)
const pct = (n: number) => `${(n * 100).toFixed(0)}%`

console.log(
  '\nRANKED — least explained by a vertical slide first.\n' +
    "  explained  how much of this figure's difference the slide accounts for\n" +
    '  left       what is still different once the slide is corrected, in grey\n' +
    '             levels 0-255 averaged over the figure\n',
)
const listed = values.verbose ? compared : compared.slice(0, LISTED)
for (const r of listed) {
  const worst = [...r.ranges]
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .slice(0, 3)
    .map(g => (g.from === g.to ? `y=${g.from}` : `y=${g.from}-${g.to}`))
  console.log(
    `  ${pct(r.explained).padStart(4)}  left ${r.aligned.toFixed(1).padStart(5)}  ${r.name}`,
  )
  console.log(
    `        slid ${describeOffsets(r.offsets) || 'nowhere'}${
      worst.length ? `   worst at ${worst.join(', ')}` : ''
    }`,
  )
}
if (compared.length > listed.length) {
  console.log(
    `\n  … ${compared.length - listed.length} more, every one better explained by its slide\n` +
      '    than any figure above it (--verbose lists them).',
  )
}

for (const [verdict, label] of [
  ['resized', 'RESIZED — the canvas changed size, so rows do not line up'],
  ['added', 'ADDED — no baseline to compare against'],
  ['error', 'COULD NOT BE READ'],
] as const) {
  const group = by(verdict)
  if (group.length) {
    console.log(`\n${label} (${group.length})`)
    for (const r of group) {
      console.log(`  ${r.name}${r.note ? `  ${r.note}` : ''}`)
    }
  }
}

// The vertical steps the corpus moved by, which is the evidence for what caused
// it: the label-margin change shows up here as every figure sliding by a
// multiple of 8 image px, one multiple per track in the stack.
const steps = new Map<number, number>()
for (const r of compared) {
  for (const [dy, n] of r.offsets) {
    steps.set(dy, (steps.get(dy) ?? 0) + n)
  }
}
const commonSteps = [...steps]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .sort((a, b) => a[0] - b[0])
  .map(
    ([dy]) => `${dy > 0 ? '+' : ''}${dy}px (${dy / DEVICE_SCALE_FACTOR} css)`,
  )

console.log(
  `\n${compared.length} compared, ${by('resized').length} resized, ` +
    `${by('added').length} added, ${by('error').length} unreadable`,
)
console.log(`slides in play: ${commonSteps.join(', ')}`)

if (values.json) {
  writeFileSync(values.json, `${JSON.stringify(results, null, 2)}\n`)
  console.log(`wrote ${values.json}`)
}

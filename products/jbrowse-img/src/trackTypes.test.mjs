import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvox = path.join(__dirname, '../data/volvox')
const fasta = path.join(volvox, 'volvox.fa')
const gff = path.join(volvox, 'volvox.sort.gff3.gz')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

// bigbed/bedgz have no example screenshot in the README, so these guard that
// the two feature-file track types still render glyphs end-to-end. force:true
// renders without a feature-density cap. <path> elements are the rendered
// feature glyphs, so asserting on them catches an empty render (label/ruler
// only) — the failure mode the Hi-C export bug had.
test('a bigbed (.bb) track renders feature glyphs to SVG', async () => {
  const svg = await renderRegion({
    fasta,
    loc: 'ctgA:1-50000',
    noRasterize: true,
    trackList: [['bigbed', [path.join(volvox, 'volvox.bb'), 'force:true']]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<path'), 'bigbed should render feature glyphs')
})

test('a bedgz (.bed.gz) track renders feature glyphs to SVG', async () => {
  const svg = await renderRegion({
    fasta,
    loc: 'ctgA:1-50000',
    noRasterize: true,
    trackList: [
      ['bedgz', [path.join(volvox, 'volvox-bed12.bed.gz'), 'force:true']],
    ],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<path'), 'bedgz should render feature glyphs')
})

// A track whose data file can't be loaded logs the failure but leaves the SVG
// with that track blank rather than throwing. A headless export must fail on
// that (a broken image written as if it succeeded), so the logged error is
// captured and made fatal.
test('an unreadable track file fails the render instead of silently blanking', async () => {
  await assert.rejects(
    renderRegion({
      fasta,
      loc: 'ctgA:1-5000',
      trackList: [['bam', ['/nonexistent/reads.bam']]],
    }),
    /ENOENT|no such file/,
  )
})

// A prior failed render's late async logging must not bleed into and fail a
// subsequent good render (the error capture is scoped per-render).
test('a good render after a failed one is unaffected', async () => {
  await assert.rejects(
    renderRegion({
      fasta,
      loc: 'ctgA:1-5000',
      trackList: [['bam', ['/nonexistent/reads.bam']]],
    }),
  )
  const svg = await renderRegion({ fasta, loc: 'ctgA:1-5000' })
  assert.ok(svg.includes('<svg'), 'the good render should still succeed')
})

// The canvas-based feature and variant displays take a CSS color or a jexl in
// LinearCanvasBaseDisplay's `color` slot. `color:` used to write a `colorBy`
// object neither of them has, which was dropped as an unknown MST key, so the
// modifier did nothing at all on these track types. Colors reach the SVG
// resolved to rgb(), so assert on that rather than the CSS name.
const fillCounts = svg => {
  const counts = {}
  for (const [, fill] of svg.matchAll(/fill="(rgb\([^)]*\))"/g)) {
    counts[fill] = (counts[fill] ?? 0) + 1
  }
  return counts
}
const GOLDENROD = 'rgb(218,165,32)'
// The UTR default (#357089). A gene glyph draws its transcripts' UTRs from the
// `utrColor` slot, so an untouched track has TWO default fills, not one.
const UTR_TEAL = 'rgb(53,112,137)'
const MAGENTA = 'rgb(255,0,255)'
const TOMATO = 'rgb(255,99,71)'
const CORNFLOWER = 'rgb(100,149,237)'

// `heightMode:grow` because these tests COUNT fills, and a fixed-height track
// is a viewport: the export wraps its body in an SvgClipRect of the track
// height, so this window at the default 256px shows 45 of the 134 features and
// none of the 11 UTRs — they lay out below the fold. The counts below used to
// pass only because the export serialized every glyph into the file and let the
// clip hide it; `grow` sizes the track to its content (623px here), which is
// what makes "every default-colored glyph should now be magenta" a statement
// about the picture rather than about the file.
const renderGff = (...opts) =>
  renderRegion({
    fasta,
    loc: 'ctgA:1-20000',
    noRasterize: true,
    trackList: [['gffgz', [gff, 'force:true', 'heightMode:grow', ...opts]]],
  })

// `color` describes the FEATURE, so it reaches a transcript's UTRs too and the
// whole track lands on one color; only an explicit `utrColor` contrasts them
// again. That rule is getBoxColor's (plugins/canvas), and this asserts the
// end-to-end consequence of it — which is why the count to match is BOTH
// defaults and not just the goldenrod one.
test('color:<css color> repaints a feature track, UTRs included', async () => {
  const plain = fillCounts(await renderGff())
  const magenta = fillCounts(await renderGff('color:magenta'))
  assert.ok(plain[GOLDENROD] > 0, 'baseline features are the goldenrod default')
  assert.ok(plain[UTR_TEAL] > 0, 'baseline UTRs are the utrColor default')
  assert.equal(
    magenta[MAGENTA],
    plain[GOLDENROD] + plain[UTR_TEAL],
    'every default-colored glyph should now be magenta',
  )
  assert.equal(
    magenta[GOLDENROD],
    undefined,
    'no goldenrod glyph should remain',
  )
  assert.equal(magenta[UTR_TEAL], undefined, 'no teal UTR should remain')
})

// `color:strand` names a scheme on alignments; on the canvas displays it is the
// exact jexl `colorByMode` reads back as strand mode. Same spelling, same
// meaning, different slot.
test('color:strand splits a feature track by strand', async () => {
  const counts = fillCounts(await renderGff('color:strand'))
  assert.ok(counts[TOMATO] > 0, 'forward-strand features should be tomato')
  assert.ok(
    counts[CORNFLOWER] > 0,
    'reverse-strand features should be cornflowerblue',
  )
})

// The canvas analogue of alignments' color:tag:X — one stable color per distinct
// value of the attribute, via the same randomColor jexl the display's own
// "Color by attribute" dialog writes.
test('color:attribute:<name> gives each attribute value its own color', async () => {
  const plain = fillCounts(await renderGff())
  const byType = fillCounts(await renderGff('color:attribute:type'))
  assert.equal(
    plain[GOLDENROD],
    134,
    'baseline paints every feature the one goldenrod default',
  )
  assert.equal(
    byType[GOLDENROD],
    undefined,
    'no feature should still carry the default color',
  )
  assert.ok(
    Object.keys(byType).length > Object.keys(plain).length + 5,
    `expected a color per feature type, got ${Object.keys(byType).length}`,
  )
})

test('color:<css color> repaints a variant track', async () => {
  const vcf = path.join(volvox, 'volvox.filtered.vcf.gz')
  const render = (...opts) =>
    renderRegion({
      fasta,
      loc: 'ctgA:1-20000',
      noRasterize: true,
      trackList: [['vcfgz', [vcf, 'force:true', ...opts]]],
    })
  const magenta = fillCounts(await render('color:magenta'))
  assert.ok(magenta[MAGENTA] > 0, 'variant glyphs should be magenta')
})

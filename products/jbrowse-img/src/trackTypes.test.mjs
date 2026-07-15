import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvox = path.join(__dirname, '../data/volvox')
const fasta = path.join(volvox, 'volvox.fa')

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

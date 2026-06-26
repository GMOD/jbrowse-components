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

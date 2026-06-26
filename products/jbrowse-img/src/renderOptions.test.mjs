import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvox = path.join(__dirname, '../data/volvox')
const fasta = path.join(volvox, 'volvox.fa')
const bam = path.join(volvox, 'volvox-sorted.bam')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

function render(opts) {
  return renderRegion({
    fasta,
    loc: 'ctgA:1-20000',
    width: 1200,
    trackList: [['bam', [bam, 'force:true']]],
    ...opts,
  })
}

// Canvas layers (pileup/coverage) rasterize into a <image data:image/png …> by
// default to keep file sizes down; --noRasterize emits them as SVG vectors.
test('rasterization is on by default and --noRasterize turns it off', async () => {
  const rasterized = await render({})
  const vector = await render({ noRasterize: true })
  assert.match(rasterized, /data:image\/png/, 'default should embed a raster image')
  assert.ok(
    !/data:image\/png/.test(vector),
    'noRasterize should emit vectors, no embedded raster',
  )
  assert.ok(
    vector.length > rasterized.length,
    'the vector SVG is larger than the rasterized one',
  )
})

// --showGridlines draws genomic coordinate gridlines (vertical <line>s).
test('--showGridlines adds coordinate gridlines', async () => {
  const without = await render({ noRasterize: true })
  const withGrid = await render({ noRasterize: true, showGridlines: true })
  const lineCount = (svg) => (svg.match(/<line/g) || []).length
  assert.ok(
    lineCount(withGrid) > lineCount(without),
    'gridlines should add <line> elements',
  )
})

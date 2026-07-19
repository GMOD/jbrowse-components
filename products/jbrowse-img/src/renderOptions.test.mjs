import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvox = path.join(__dirname, '../data/volvox')
const fasta = path.join(volvox, 'volvox.fa')
const bam = path.join(volvox, 'volvox-sorted.bam')
const cytobands = path.join(volvox, 'volvox.cytoband.txt')

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
  assert.match(
    rasterized,
    /data:image\/png/,
    'default should embed a raster image',
  )
  assert.ok(
    !/data:image\/png/.test(vector),
    'noRasterize should emit vectors, no embedded raster',
  )
  assert.ok(
    vector.length > rasterized.length,
    'the vector SVG is larger than the rasterized one',
  )
})

// --showGridlines draws genomic coordinate gridlines. The ticks are collapsed
// into a clipped <path> pair (minor/major) rather than a <line> each, so assert
// on the gridline clip group the export wraps them in.
test('--showGridlines adds coordinate gridlines', async () => {
  const without = await render({ noRasterize: true })
  const withGrid = await render({ noRasterize: true, showGridlines: true })
  assert.ok(!/gridline-clip/.test(without), 'no gridlines without the flag')
  assert.match(withGrid, /gridline-clip/, 'gridlines should add a clip group')
})

// --cytobands shows the "you are here" overview: a cytoband ideogram plus the
// OverviewScalebarPolygon trapezoid (a makeStyles component). That styled
// component crashed in the node/jsdom export because emotion had no cache in
// context — renderToStaticMarkup now provides one. This exercises the whole
// path: cytobands load (regression for the CytobandAdapter `cytobandLocation`
// slot), the overview renders, and the trapezoid gets its tertiary fill.
test('--cytobands renders the overview scalebar polygon', async () => {
  const svg = await render({ noRasterize: true, cytobands })
  assert.match(svg, /<polygon/, 'overview trapezoid should render')
  assert.match(
    svg,
    /fill="#42777f"/,
    'trapezoid is filled with the tertiary palette color',
  )
})

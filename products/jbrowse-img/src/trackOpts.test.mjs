import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvox = path.join(__dirname, '../data/volvox')
const fasta = path.join(volvox, 'volvox.fa')
const bam = path.join(volvox, 'volvox-rg.bam')
const sortedBam = path.join(volvox, 'volvox-sorted.bam')
const coverageBw = path.join(volvox, 'volvox-sorted.bam.coverage.bw')
const multiVcf = path.join(volvox, 'volvox.test.vcf.gz')
const aliases = path.join(volvox, 'volvox.aliases.txt')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

// force:true so the alignments track renders without a feature-density cap.
test('group:tag:RG renders an alignments track to SVG', async () => {
  const svg = await renderRegion({
    fasta,
    loc: 'ctgA:1-2000',
    noRasterize: true,
    trackList: [['bam', [bam, 'group:tag:RG', 'force:true']]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
})

test('a JSON modifier merges into the display snapshot', async () => {
  const svg = await renderRegion({
    fasta,
    loc: 'ctgA:1-2000',
    noRasterize: true,
    trackList: [['bam', [bam, '{"colorBy":{"type":"strand"}}', 'force:true']]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
})

// Renders with a pile of alignment overlay/layout modifiers at once. The value
// is that showTrack must ACCEPT every snapshot key these produce — a stale key
// (the silently-broken-modifier class, e.g. the old setSashimiArcs) would throw
// an invalid-snapshot error and yield no display, not just a no-op.
test('alignment overlay/layout modifiers all produce a valid display snapshot', async () => {
  const svg = await renderRegion({
    fasta,
    loc: 'ctgA:1-2000',
    noRasterize: true,
    trackList: [
      [
        'bam',
        [
          sortedBam,
          'color:strand',
          'sort:base',
          'group:strand',
          'arcs:cloud',
          'coverageHeight:200',
          'sashimi:down',
          'softClipping:true',
          'featureHeight:compact',
          'height:500',
          'force:true',
        ],
      ],
    ],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
})

test('linkedReads:bezier enables the bezier overlay (not an out-of-enum mode)', async () => {
  const svg = await renderRegion({
    fasta,
    loc: 'ctgA:1-2000',
    noRasterize: true,
    trackList: [['bam', [sortedBam, 'linkedReads:bezier', 'force:true']]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
})

// display:multivariant selects the multi-sample genotype-matrix display for a
// VCF track (instead of the default LinearVariantDisplay) and renders its cells.
test('display:multivariant exports the multi-sample variant display', async () => {
  const svg = await renderRegion({
    fasta,
    aliases,
    loc: 'ctgA:2900-3300',
    noRasterize: true,
    trackList: [
      ['vcfgz', [multiVcf, 'display:multivariant', 'height:500', 'force:true']],
    ],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  // the genotype matrix paints a reference-color background rect plus alt cells
  assert.ok(
    (svg.match(/<rect/g) || []).length > 5,
    'should draw genotype cells',
  )
})

// Exercises every wiggle score snapshot key (including autoscale/defaultRendering
// whose getters are named divergently), confirming the wiggle display accepts
// them via showTrack's display snapshot.
test('wiggle score modifiers all produce a valid display snapshot', async () => {
  const svg = await renderRegion({
    fasta,
    loc: 'ctgA:1-20000',
    noRasterize: true,
    trackList: [
      [
        'bigwig',
        [
          coverageBw,
          'scaletype:log',
          'fill:false',
          'minmax:0:50',
          'color:red',
          'crosshatch:true',
          'resolution:fine',
          'autoscale:localsd',
          'height:200',
        ],
      ],
    ],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
})

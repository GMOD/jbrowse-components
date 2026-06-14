import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvox = path.join(__dirname, '../data/volvox')
const fasta = path.join(volvox, 'volvox.fa')
const bam = path.join(volvox, 'volvox-rg.bam')

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

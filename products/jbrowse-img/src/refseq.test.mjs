import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvoxFasta = path.join(__dirname, '../data/volvox/volvox.fa')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

test('--refseq renders sequence track into SVG', async () => {
  const svg = await renderRegion({
    fasta: volvoxFasta,
    loc: 'ctgA:1-100',
    refseq: true,
    noRasterize: true,
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  // The sequence track uses its trackId as a clip-path id in the SVG
  assert.ok(svg.includes('refseq'), 'sequence track should appear in SVG')
})

test('without --refseq sequence track is absent', async () => {
  const svg = await renderRegion({
    fasta: volvoxFasta,
    loc: 'ctgA:1-100',
    noRasterize: true,
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(!svg.includes('refseq'), 'sequence track should not appear in SVG')
})

import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../data/volvox')
const volvoxFasta = path.join(dataDir, 'volvox.fa')
const sv = path.join(dataDir, 'volvox.dup.vcf.gz')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

test('circular renders structural variant chords from a VCF', async () => {
  const svg = await renderRegion({
    mode: 'circular',
    fasta: volvoxFasta,
    trackList: [['vcfgz', [sv]]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  // chords + ideogram are drawn as <path> elements; the SV track adds chords on
  // top of the 2 ideogram paths.
  const paths = svg.match(/<path/g) ?? []
  assert.ok(
    paths.length > 2,
    `expected variant chords, got ${paths.length} paths`,
  )
})

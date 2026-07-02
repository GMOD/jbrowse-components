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

// CircularView reads assemblyManager.get() without awaiting, so a failed
// assembly load never reaches the session and its init never completes — which
// would hang headlessly. The assembly error is detected directly so it fails
// fast instead.
test('circular with an unreadable assembly rejects instead of hanging', async () => {
  await assert.rejects(
    renderRegion({
      mode: 'circular',
      fasta: '/nonexistent/ref.fa',
      trackList: [['vcfgz', [sv]]],
    }),
    /ENOENT|no such file/,
  )
})

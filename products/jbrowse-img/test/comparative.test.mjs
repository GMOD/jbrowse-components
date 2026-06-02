import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../data/volvox')
const volvoxFasta = path.join(dataDir, 'volvox.fa')
const paf = path.join(dataDir, 'volvox-self.paf')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

// The two assemblies need distinct names, so the second is a copy of volvox
// under a different filename (basename becomes the assembly name).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jbimg-cmp-'))
const fasta2 = path.join(tmp, 'volvox2.fa')
fs.copyFileSync(volvoxFasta, fasta2)
fs.copyFileSync(`${volvoxFasta}.fai`, `${fasta2}.fai`)

test('dotplot renders two assemblies via a PAF', async () => {
  const svg = await renderRegion({
    mode: 'dotplot',
    fasta: volvoxFasta,
    fasta2,
    trackList: [['paf', [paf]]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<image'), 'dotplot should rasterize a dots layer')
})

test('synteny renders two assemblies via a PAF', async () => {
  const svg = await renderRegion({
    mode: 'synteny',
    fasta: volvoxFasta,
    fasta2,
    trackList: [['paf', [paf]]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('<image'), 'synteny should rasterize a ribbon layer')
})

test('comparative mode without a second assembly throws', async () => {
  await assert.rejects(
    renderRegion({
      mode: 'dotplot',
      fasta: volvoxFasta,
      trackList: [['paf', [paf]]],
    }),
    /second assembly/,
  )
})

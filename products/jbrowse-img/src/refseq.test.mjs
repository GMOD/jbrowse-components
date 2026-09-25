import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
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

test('--track names the sequence track of an assembly written in shorthand', async () => {
  const server = createServer((req, res) => {
    res.end(readFileSync(path.join(path.dirname(volvoxFasta), req.url)))
  })
  await new Promise(resolve => server.listen(0, resolve))
  const uri = `http://localhost:${server.address().port}/volvox.fa`
  const config = path.join(mkdtempSync(path.join(tmpdir(), 'jbimg-')), 'c.json')
  writeFileSync(
    config,
    JSON.stringify({ assemblies: [{ name: 'volvox', uri }] }),
  )
  try {
    const svg = await renderRegion({
      config,
      loc: 'ctgA:1-100',
      showTracks: [['track', ['volvox-ReferenceSequenceTrack']]],
      noRasterize: true,
    })
    assert.ok(
      svg.includes('volvox-ReferenceSequenceTrack'),
      'sequence track should appear in SVG',
    )
  } finally {
    server.close()
  }
})

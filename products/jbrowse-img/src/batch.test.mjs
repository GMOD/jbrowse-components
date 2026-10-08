import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../data/volvox')

const { runBatch } = await import('../src/runBatch.ts')

// volvox.filtered.vcf.gz is SNVs and short indels with no SVTYPE. Its first
// eleven records hold an SNV every read carries, a 1 bp deletion and a 1 bp
// insertion, which between them take both sort types and both count paths.
test('renders small variants sorted and marked at the variant, and counts who differs', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-batch-'))
  const { done, failures, skipped } = await runBatch({
    vcf: path.join(dataDir, 'volvox.filtered.vcf.gz'),
    fasta: path.join(dataDir, 'volvox.fa'),
    trackList: [['bam', [path.join(dataDir, 'volvox-sorted.bam')]]],
    outDir,
    format: 'svg',
    limit: 11,
    jobs: 1,
    manifest: true,
    progress: { step() {}, finish() {} },
  })
  assert.equal(done, 11)
  assert.deepEqual(failures, [])
  assert.deepEqual(skipped, [])

  const [head, ...rows] = fs
    .readFileSync(path.join(outDir, 'manifest.tsv'), 'utf8')
    .trim()
    .split('\n')
    .map(row => row.split('\t'))
  const column = name => rows.map(row => row[head.indexOf(name)])
  // 50 bp each side of a 1 bp REF, and of the deletion's 3 bp one
  assert.deepEqual(column('locs').slice(0, 5), [
    'ctgA:227-327',
    'ctgA:1644-1744',
    'ctgA:2594-2694',
    'ctgA:3163-3263',
    'ctgA:3808-3910',
  ])
  const alt = column('alt')
  assert.equal(alt[0], '3/3', 'an SNV every spanning read carries')
  // 13 reads have the gap; three more differ at the base by a mismatch, which
  // is not the deletion
  assert.equal(alt[4], '13/18', 'a deletion: its carriers leave the depth')
  assert.equal(alt[10], '5/22', 'an insertion')

  // the band over the call is the image's one translucent rect, a base wide
  const svg = fs.readFileSync(path.join(outDir, column('file')[0]), 'utf8')
  const bands = [...svg.matchAll(/<rect[^>]*width="(\d+)"[^>]*fill-opacity/g)]
  assert.deepEqual(
    bands.map(([, width]) => width),
    ['15'],
  )
  fs.rmSync(outDir, { recursive: true })
})

/**
 * @jest-environment node
 */

import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { defaultAttributesToIndex } from '../util.ts'
import { indexGtf } from './gtfAdapter.ts'

// a trix .ix input line is `<record id> <word> <word>...`
function loc(line: string) {
  return decodeURIComponent(line.slice(2, line.indexOf('"|"')))
}
function words(line: string) {
  return line.trim().split(' ').slice(1)
}

describe('indexGtf', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtf-index-'))
  })
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  async function index(
    lines: string[],
    attributesToIndex = defaultAttributesToIndex,
  ) {
    const file = path.join(tmpDir, 'test.gtf')
    fs.writeFileSync(file, [...lines, ''].join('\n'))
    const results: string[] = await Array.fromAsync(
      indexGtf({
        config: { trackId: 'gtf-track' },
        attributesToIndex,
        inLocation: file,
        outDir: tmpDir,
        onStart: () => {},
        onUpdate: () => {},
      }),
    )
    return results
  }

  // GTF has no gene/transcript rows, so a per-row index would point every hit
  // at one exon
  const eden = [
    '#!genome-build volvox',
    'ctgA\t.\texon\t1050\t1500\t.\t+\t.\ttranscript_id "EDEN.1"; gene_id "EDEN"; gene_name "EDEN";',
    'ctgA\t.\tCDS\t3000\t3902\t.\t+\t0\ttranscript_id "EDEN.1"; gene_id "EDEN"; gene_name "EDEN";',
    'ctgA\t.\texon\t1300\t1500\t.\t+\t.\ttranscript_id "EDEN.2"; gene_id "EDEN"; gene_name "EDEN";',
    'ctgA\t.\texon\t7600\t9000\t.\t+\t.\ttranscript_id "EDEN.2"; gene_id "EDEN"; gene_name "EDEN";',
  ]

  test('a gene entry spans every row of the gene, not one exon', async () => {
    const results = await index(eden)
    const gene = results.find(r => words(r).join(',') === 'EDEN')!
    expect(loc(gene)).toBe('ctgA:1050..9000')
  })

  test('each transcript gets its own entry spanning its own rows', async () => {
    const results = await index(eden)
    expect(results.map(r => [words(r).join(' '), loc(r)]).sort()).toEqual([
      ['EDEN', 'ctgA:1050..9000'],
      ['EDEN.1', 'ctgA:1050..3902'],
      ['EDEN.2', 'ctgA:1300..9000'],
    ])
  })

  test('the shared GFF3-style defaults reach the GTF attribute spellings', async () => {
    const results = await index([
      'chr1\tHAVANA\ttranscript\t100\t500\t.\t+\t.\tgene_id "ENSG1"; transcript_id "ENST1"; transcript_name "BRCA1-201"; gene_name "BRCA1";',
    ])
    expect(results.map(r => words(r)).sort()).toEqual([
      // gene_name leads so it becomes the adapter's display label
      ['BRCA1', 'ENSG1'],
      ['BRCA1-201', 'ENST1'],
    ])
  })

  test('an explicitly requested GTF attribute is indexed verbatim', async () => {
    const results = await index(
      [
        'chr1\t.\ttranscript\t1\t9\t.\t+\t.\tgene_id "g1"; gene_biotype "lncRNA";',
      ],
      ['gene_biotype'],
    )
    expect(results.map(r => words(r))).toEqual([['lncRNA']])
  })

  test('rows with no indexable attribute and malformed rows are skipped', async () => {
    const results = await index([
      'chr1\t.\texon\t1\t9\t.\t+\t.\thavana_gene "OTTHUMG1";',
      'chr1\t.\texon\t20\t30',
      'chr1\t.\texon\t40\t50\t.\t+\t.\tgene_id "ok";',
    ])
    expect(results.map(r => words(r))).toEqual([['ok']])
  })

  test('commas in a value are split into separate words', async () => {
    // a comma separates record ids in the .ix format, so it can never survive
    // into an indexed word
    const results = await index([
      'chr1\t.\texon\t1\t9\t.\t+\t.\tgene_id "g1"; gene_name "alpha,beta";',
    ])
    expect(results.map(r => words(r))).toEqual([['alpha', 'beta', 'g1']])
  })

  test('a semicolon inside a quoted value does not truncate it', async () => {
    // the ';' entry separator can also sit inside a value, where splitting on
    // it indexed only the part before the semicolon
    const results = await index([
      'chr1\t.\texon\t1\t9\t.\t+\t.\tgene_id "g1"; gene_name "alpha; beta";',
    ])
    expect(results.map(r => words(r))).toEqual([['alpha;', 'beta', 'g1']])
  })

  test('same-named genes on different refs stay separate entries', async () => {
    const results = await index([
      'chr1\t.\texon\t1\t9\t.\t+\t.\tgene_id "dup";',
      'chr2\t.\texon\t100\t200\t.\t+\t.\tgene_id "dup";',
    ])
    expect(results.map(r => loc(r))).toEqual(['chr1:1..9', 'chr2:100..200'])
  })

  // What a GtfTabixAdapter track hands over: the reader gunzips on the suffix,
  // so the same walk has to reach the same entries from a compressed file
  test('a gzipped GTF indexes to the same entries as the plain one', async () => {
    const rows = [
      'ctgA\t.\texon\t1050\t1500\t.\t+\t.\tgene_id "EDEN"; gene_name "EDEN";',
      'ctgA\t.\tCDS\t3000\t3902\t.\t+\t0\tgene_id "EDEN"; gene_name "EDEN";',
    ]
    const file = path.join(tmpDir, 'test.gtf.gz')
    fs.writeFileSync(file, gzipSync(Buffer.from([...rows, ''].join('\n'))))
    const results = await Array.fromAsync(
      indexGtf({
        config: { trackId: 'gtf-tabix-track' },
        attributesToIndex: defaultAttributesToIndex,
        inLocation: file,
        outDir: tmpDir,
        onStart: () => {},
        onUpdate: () => {},
      }),
    )
    expect(results.map(r => [words(r).join(' '), loc(r)])).toEqual([
      ['EDEN', 'ctgA:1050..3902'],
    ])
  })
})

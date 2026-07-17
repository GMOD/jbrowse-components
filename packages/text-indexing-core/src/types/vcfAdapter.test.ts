/**
 * @jest-environment node
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { indexVcf } from './vcfAdapter.ts'

async function indexToArray(file: string, tmpDir: string) {
  const results: string[] = []
  const generator = indexVcf({
    config: { trackId: 'test-track' },
    attributesToIndex: ['ID', 'Name'],
    inLocation: file,
    outDir: tmpDir,
    onStart: () => {},
    onUpdate: () => {},
  })
  for await (const record of generator) {
    results.push(record)
  }
  return results
}

describe('indexVcf', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcf-index-'))
  })
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function writeVcf(lines: string[]) {
    const file = path.join(tmpDir, 'test.vcf')
    fs.writeFileSync(file, [...lines, ''].join('\n'))
    return file
  }

  test('an empty END= falls back to pos+1 rather than 0', async () => {
    // regression: Number('') is a finite 0, so an empty END= used to yield the
    // location ctgA:200..0 instead of ctgA:200..201
    const file = writeVcf([
      '##fileformat=VCFv4.2',
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
      'ctgA\t200\tvar1\tA\tT\t.\t.\tEND=',
    ])
    const results = await indexToArray(file, tmpDir)
    expect(results).toHaveLength(1)
    expect(results[0]).toContain(encodeURIComponent('ctgA:200..201'))
  })

  test('a valid END= is used as the location end', async () => {
    const file = writeVcf([
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
      'ctgA\t300\tvar2\tA\t<DEL>\t.\t.\tEND=500',
    ])
    const results = await indexToArray(file, tmpDir)
    expect(results).toHaveLength(1)
    expect(results[0]).toContain(encodeURIComponent('ctgA:300..500'))
  })

  test('a missing END falls back to pos+1', async () => {
    const file = writeVcf([
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
      'ctgA\t100\tvar3\tA\tT\t.\t.\t.',
    ])
    const results = await indexToArray(file, tmpDir)
    expect(results).toHaveLength(1)
    expect(results[0]).toContain(encodeURIComponent('ctgA:100..101'))
  })

  test('a comma-separated ID emits one record per variant id', async () => {
    const file = writeVcf([
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
      'ctgA\t400\tvarA,varB\tA\tT\t.\t.\t.',
    ])
    const results = await indexToArray(file, tmpDir)
    expect(results).toHaveLength(2)
    expect(results[0]).toContain('varA')
    expect(results[1]).toContain('varB')
  })

  test('rows without an id (.) and malformed short rows are skipped', async () => {
    const file = writeVcf([
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
      'ctgA\t500\t.\tA\tT\t.\t.\t.',
      'ctgA\t600',
      'ctgA\t700\tvar4\tA\tT\t.\t.\t.',
    ])
    const results = await indexToArray(file, tmpDir)
    expect(results).toHaveLength(1)
    expect(results[0]).toContain('var4')
  })
})

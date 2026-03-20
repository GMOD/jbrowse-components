/**
 * @jest-environment node
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { parseMaf } from './maf-parser.ts'

function writeTmp(content: string) {
  const tmpFile = path.join(os.tmpdir(), `maf-test-${Date.now()}.maf`)
  fs.writeFileSync(tmpFile, content)
  return tmpFile
}

test('parses a basic MAF alignment block', async () => {
  const data = [
    '##maf version=1',
    '',
    'a score=100',
    's hg38.chr1     100 50 + 249250621 ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTAC',
    's mm39.chr1      200 50 + 195471971 ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTAC',
    '',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseMaf(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
  expect(records[0]!.tname).toBe('hg38.chr1')
  expect(records[0]!.tstart).toBe(100)
  expect(records[0]!.tend).toBe(150)
  expect(records[0]!.qname).toBe('mm39.chr1')
  expect(records[0]!.qstart).toBe(200)
  expect(records[0]!.qend).toBe(250)
  expect(records[0]!.strand).toBe('+')
  expect(records[0]!.numMatches).toBe(50)
})

test('handles reverse strand MAF entries', async () => {
  const data = [
    'a score=50',
    's hg38.chr1 100 10 + 1000 ACGTACGTAC',
    's mm39.chr1 200 10 - 500  ACGTACGTAC',
    '',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseMaf(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
  expect(records[0]!.strand).toBe('-')
  // Reverse strand: start = srcSize - start - size = 500 - 200 - 10 = 290
  expect(records[0]!.qstart).toBe(290)
  expect(records[0]!.qend).toBe(300)
})

test('generates CIGAR from alignment columns', async () => {
  const data = [
    'a score=100',
    's hg38.chr1 0 5 + 100 ACG-T',
    's mm39.chr1 0 4 + 100 AC-GT',
    '',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseMaf(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
  // A vs A: M, C vs C: M, G vs -: D, - vs G: I, T vs T: M
  expect(records[0]!.cigar).toBe('2M1D1I1M')
})

test('filters by assembly names', async () => {
  const data = [
    'a score=100',
    's hg38.chr1 0 5 + 100 ACGTA',
    's mm39.chr1 0 5 + 100 ACGTA',
    's rn7.chr1  0 5 + 100 ACGTA',
    '',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseMaf(tmpFile, ['hg38', 'mm39'])
  fs.unlinkSync(tmpFile)

  // Only hg38 x mm39 pair, not rn7
  expect(records).toHaveLength(1)
  expect(records[0]!.tname).toBe('hg38.chr1')
  expect(records[0]!.qname).toBe('mm39.chr1')
})

test('handles multiple alignment blocks', async () => {
  const data = [
    'a score=100',
    's hg38.chr1 0 10 + 100 ACGTACGTAC',
    's mm39.chr1 0 10 + 100 ACGTACGTAC',
    '',
    'a score=50',
    's hg38.chr1 100 10 + 100 ACGTACGTAC',
    's mm39.chr1 100 10 + 100 ACGTACGTAC',
    '',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseMaf(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(2)
  expect(records[0]!.tstart).toBe(0)
  expect(records[1]!.tstart).toBe(100)
})

test('skips blocks with fewer than 2 sequences', async () => {
  const data = [
    'a score=100',
    's hg38.chr1 0 10 + 100 ACGTACGTAC',
    '',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseMaf(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(0)
})

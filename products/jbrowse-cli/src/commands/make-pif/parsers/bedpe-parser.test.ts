/**
 * @jest-environment node
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { parseBedpe } from './bedpe-parser.ts'

function writeTmp(content: string) {
  const tmpFile = path.join(os.tmpdir(), `bedpe-test-${Date.now()}.bedpe`)
  fs.writeFileSync(tmpFile, content)
  return tmpFile
}

test('parses basic BEDPE entries', async () => {
  const data = [
    'chr1\t100\t5000\tchr2\t200\t5100\tname1\t100\t+\t+\tSYN',
    'chr1\t6000\t8000\tchr2\t6000\t8000\tname2\t100\t+\t-\tINV',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseBedpe(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(2)

  expect(records[0]!.tname).toBe('chr1')
  expect(records[0]!.tstart).toBe(100)
  expect(records[0]!.tend).toBe(5000)
  expect(records[0]!.qname).toBe('chr2')
  expect(records[0]!.qstart).toBe(200)
  expect(records[0]!.qend).toBe(5100)
  expect(records[0]!.strand).toBe('+')
  expect(records[0]!.syriType).toBe('SYN')

  expect(records[1]!.strand).toBe('-')
  expect(records[1]!.syriType).toBe('INV')
})

test('handles BEDPE without type column', async () => {
  const data = 'chr1\t100\t5000\tchr2\t200\t5100\tname1\t100\t+\t+\n'

  const tmpFile = writeTmp(data)
  const records = await parseBedpe(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
  expect(records[0]!.syriType).toBeUndefined()
})

test('maps BEDPE type codes correctly', async () => {
  const data = [
    'chr1\t0\t100\tchr2\t0\t100\tn\t0\t+\t+\tTRA',
    'chr1\t0\t100\tchr2\t0\t100\tn\t0\t+\t+\tDUP',
    'chr1\t0\t100\tchr2\t0\t100\tn\t0\t+\t+\tINVTR',
    'chr1\t0\t100\tchr2\t0\t100\tn\t0\t+\t+\tINVDP',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseBedpe(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records[0]!.syriType).toBe('TRANS')
  expect(records[1]!.syriType).toBe('DUP')
  expect(records[2]!.syriType).toBe('TRANS')
  expect(records[3]!.syriType).toBe('DUP')
})

test('skips comments and blank lines', async () => {
  const data = [
    '#header',
    '',
    'chr1\t0\t100\tchr2\t0\t100\tn\t0\t+\t+\tSYN',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseBedpe(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
})

test('skips lines with fewer than 6 columns', async () => {
  const data = 'chr1\t0\t100\tchr2\t0\n'

  const tmpFile = writeTmp(data)
  const records = await parseBedpe(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(0)
})

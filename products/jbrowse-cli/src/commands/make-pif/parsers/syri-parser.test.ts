/**
 * @jest-environment node
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { parseSyriOutput } from './syri-parser.ts'

function writeTmp(content: string) {
  const tmpFile = path.join(os.tmpdir(), `syri-test-${Date.now()}.syri.out`)
  fs.writeFileSync(tmpFile, content)
  return tmpFile
}

test('parses basic SyRI alignment entries', async () => {
  const data = [
    'chr1\t100\t5000\tchr1\t200\t5100\t0\t0\t0\tSYNAL\tSYN1',
    'chr1\t6000\t8000\tchr1\t8000\t6000\t0\t0\t0\tINVAL\tINV1',
    'chr2\t100\t3000\tchr3\t500\t3400\t0\t0\t0\tTRANSAL\tTRANS1',
    'chr1\t100\t5000\tchr1\t200\t5100\t0\t0\t0\tSYN\tSYN1',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseSyriOutput(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(3)

  expect(records[0]!.tname).toBe('chr1')
  expect(records[0]!.tstart).toBe(100)
  expect(records[0]!.tend).toBe(5000)
  expect(records[0]!.qname).toBe('chr1')
  expect(records[0]!.qstart).toBe(200)
  expect(records[0]!.qend).toBe(5100)
  expect(records[0]!.strand).toBe('+')
  expect(records[0]!.syriType).toBe('SYN')

  expect(records[1]!.strand).toBe('-')
  expect(records[1]!.syriType).toBe('INV')
  expect(records[1]!.qstart).toBe(6000)
  expect(records[1]!.qend).toBe(8000)

  expect(records[2]!.syriType).toBe('TRANS')
})

test('skips structural parent entries', async () => {
  const data = [
    'chr1\t100\t5000\tchr1\t200\t5100\t0\t0\t0\tSYN\t-',
    'chr1\t100\t5000\tchr1\t200\t5100\t0\t0\t0\tSYNAL\tSYN1',
    'chr1\t6000\t8000\tchr1\t6000\t8000\t0\t0\t0\tINV\t-',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseSyriOutput(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
  expect(records[0]!.syriType).toBe('SYN')
})

test('skips comments and blank lines', async () => {
  const data = [
    '# this is a comment',
    '',
    'chr1\t100\t5000\tchr1\t200\t5100\t0\t0\t0\tSYNAL\tSYN1',
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseSyriOutput(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
})

test('handles NOTAL entries', async () => {
  const data = 'chr1\t100\t5000\tchr1\t200\t5100\t0\t0\t0\tNOTAL\t-\n'

  const tmpFile = writeTmp(data)
  const records = await parseSyriOutput(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
  expect(records[0]!.syriType).toBe('SYN')
})

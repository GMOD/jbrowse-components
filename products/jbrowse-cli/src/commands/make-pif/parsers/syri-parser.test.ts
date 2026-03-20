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

// Real SyRI format: refChr refStart refEnd - - qryChr qryStart qryEnd ID parent type -
function syriLine(
  refChr: string,
  refStart: number,
  refEnd: number,
  qryChr: string,
  qryStart: number,
  qryEnd: number,
  id: string,
  parent: string,
  type: string,
) {
  return `${refChr}\t${refStart}\t${refEnd}\t-\t-\t${qryChr}\t${qryStart}\t${qryEnd}\t${id}\t${parent}\t${type}\t-`
}

test('parses basic SyRI alignment entries', async () => {
  const data = [
    syriLine('chr1', 100, 5000, 'chr1', 200, 5100, 'SYNAL1', 'SYN1', 'SYNAL'),
    syriLine('chr1', 6000, 8000, 'chr1', 8000, 6000, 'INVAL1', 'INV1', 'INVAL'),
    syriLine('chr2', 100, 3000, 'chr3', 500, 3400, 'TRANSAL1', 'TRANS1', 'TRANSAL'),
    // SYN parent entry should be skipped
    syriLine('chr1', 100, 5000, 'chr1', 200, 5100, 'SYN1', '-', 'SYN'),
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
    syriLine('chr1', 100, 5000, 'chr1', 200, 5100, 'SYN1', '-', 'SYN'),
    syriLine('chr1', 100, 5000, 'chr1', 200, 5100, 'SYNAL1', 'SYN1', 'SYNAL'),
    syriLine('chr1', 6000, 8000, 'chr1', 6000, 8000, 'INV1', '-', 'INV'),
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
    syriLine('chr1', 100, 5000, 'chr1', 200, 5100, 'SYNAL1', 'SYN1', 'SYNAL'),
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseSyriOutput(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
})

test('skips NOTAL entries (no query mapping)', async () => {
  const data = [
    // NOTAL has - for query chromosome
    'chr1\t1\t1084\t-\t-\t-\t-\t-\tNOTAL1\t-\tNOTAL\t-',
    syriLine('chr1', 100, 5000, 'chr1', 200, 5100, 'SYNAL1', 'SYN1', 'SYNAL'),
  ].join('\n')

  const tmpFile = writeTmp(data)
  const records = await parseSyriOutput(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
  expect(records[0]!.syriType).toBe('SYN')
})

test('handles HDR entries', async () => {
  const data = syriLine('chr1', 100, 200, 'chr1', 150, 250, 'HDR1', 'SYN1', 'HDR')

  const tmpFile = writeTmp(data)
  const records = await parseSyriOutput(tmpFile)
  fs.unlinkSync(tmpFile)

  expect(records).toHaveLength(1)
  expect(records[0]!.syriType).toBe('SYN')
})

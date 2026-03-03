/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { gunzipSync } from 'zlib'

import { splitAlignmentByCigar } from './cigar-utils.ts'
import { runCommand, runInTmpDir } from '../../testUtil.ts'

const base = path.join(__dirname, '..', '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')

const exists = (p: string) => fs.existsSync(p)

test('make-pif', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn])
    expect(exists(fn)).toBeTruthy()
    expect(gunzipSync(fs.readFileSync(fn)).toString()).toMatchSnapshot()
  })
})

test('make pif with CSI', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--csi'])
    expect(exists(fn)).toBeTruthy()
    expect(exists(`${fn}.csi`)).toBeTruthy()
  })
})

describe('splitAlignmentByCigar', () => {
  const cols = (cigar: string, qs = '0', qe = '100', ts = '0', te = '100') => [
    'q1', '1000', qs, qe, '+', 't1', '1000', ts, te, 'NM:i:5', `cg:Z:${cigar}`,
  ]

  test('returns unchanged when no CIGAR', () => {
    const input = ['q1', '1000', '0', '100', '+', 't1', '1000', '0', '100', 'NM:i:5']
    expect(splitAlignmentByCigar(input, 50)).toEqual([input])
  })

  test('returns unchanged when no large indels', () => {
    const input = cols('50M20D50M')
    expect(splitAlignmentByCigar(input, 50)).toEqual([input])
  })

  test('splits at large deletion', () => {
    // 50M then 100D gap then 50M
    const result = splitAlignmentByCigar(cols('50M100D50M', '0', '100', '0', '200'), 50)
    expect(result).toHaveLength(2)
    // Block 1: query 0-50, ref 0-50
    expect(result[0]![2]).toBe('0')
    expect(result[0]![3]).toBe('50')
    expect(result[0]![7]).toBe('0')
    expect(result[0]![8]).toBe('50')
    // Block 2: query 50-100, ref 150-200
    expect(result[1]![2]).toBe('50')
    expect(result[1]![3]).toBe('100')
    expect(result[1]![7]).toBe('150')
    expect(result[1]![8]).toBe('200')
  })

  test('splits at large insertion', () => {
    // 50M then 100I gap then 50M
    const result = splitAlignmentByCigar(cols('50M100I50M', '0', '200', '0', '100'), 50)
    expect(result).toHaveLength(2)
    // Block 1: query 0-50, ref 0-50
    expect(result[0]![2]).toBe('0')
    expect(result[0]![3]).toBe('50')
    expect(result[0]![7]).toBe('0')
    expect(result[0]![8]).toBe('50')
    // Block 2: query 150-200, ref 50-100
    expect(result[1]![2]).toBe('150')
    expect(result[1]![3]).toBe('200')
    expect(result[1]![7]).toBe('50')
    expect(result[1]![8]).toBe('100')
  })

  test('splits at multiple large indels', () => {
    const result = splitAlignmentByCigar(
      cols('50M100D50M200I50M100D50M', '0', '300', '0', '400'),
      50,
    )
    expect(result).toHaveLength(4)
  })

  test('each sub-alignment has its own CIGAR', () => {
    const result = splitAlignmentByCigar(cols('30M5I20M100D40M10M', '0', '105', '0', '200'), 50)
    expect(result).toHaveLength(2)
    const cg0 = result[0]!.find(f => f.startsWith('cg:Z:'))
    const cg1 = result[1]!.find(f => f.startsWith('cg:Z:'))
    expect(cg0).toBe('cg:Z:30M5I20M')
    expect(cg1).toBe('cg:Z:40M10M')
  })
})

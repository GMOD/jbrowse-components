import { computeBackSpliceJunctions } from './backSplice.ts'

import type { FeatureData } from '../../shared/webglRpcTypes.ts'

function read(start: number, end: number, strand: number, flags = 0) {
  return {
    id: 0,
    start,
    end,
    flags,
    mapq: 255,
    insertSize: 0,
    pairOrientation: 0,
    strand,
  } as unknown as FeatureData
}

// SRR1636985.796622 at circHIPK3: the read starts on the exon's last 43 bases
// (the SA segment) and carries on into its first 58 (the primary record).
const HIPK3_PRIMARY = read(33286412, 33286470, 1)
const HIPK3_SA = 'chr11,33287469,+,43M58S,255,0;'

test('a read that crosses the circle joint counts one back-splice', () => {
  const junctions = computeBackSpliceJunctions(
    'chr11',
    [HIPK3_PRIMARY],
    [HIPK3_SA],
    [43],
  )
  expect([...junctions.values()]).toEqual([
    { start: 33286412, end: 33287511, n: 1 },
  ])
})

test('a split read whose segments run forward is not a back-splice', () => {
  const junctions = computeBackSpliceJunctions(
    'chr11',
    [read(1000, 1058, 1)],
    ['chr11,5001,+,58S43M,255,0;'],
    [0],
  )
  expect(junctions.size).toBe(0)
})

test('a minus-strand read crosses its joint from the other side', () => {
  const junctions = computeBackSpliceJunctions(
    'chr11',
    [read(5000, 5043, -1)],
    ['chr11,1001,-,43S58M,255,0;'],
    [58],
  )
  expect([...junctions.values()]).toEqual([{ start: 1000, end: 5043, n: 1 }])
})

test("a supplementary record does not count its primary's read again", () => {
  const junctions = computeBackSpliceJunctions(
    'chr11',
    [read(33287468, 33287511, 1, 0x800)],
    ['chr11,33286413,+,43S58M,255,0;'],
    [0],
  )
  expect(junctions.size).toBe(0)
})

test('segments on another chromosome or strand are not a back-splice', () => {
  const junctions = computeBackSpliceJunctions(
    'chr11',
    [HIPK3_PRIMARY, HIPK3_PRIMARY],
    ['chr2,33287469,+,43M58S,255,0;', 'chr11,33287469,-,58S43M,255,0;'],
    [43, 43],
  )
  expect(junctions.size).toBe(0)
})

test('a rolling-circle read counts its joint once however many passes cross it', () => {
  const junctions = computeBackSpliceJunctions(
    'chr1',
    [read(1000, 1500, 1)],
    ['chr1,1001,+,500S500M500S,60,0;chr1,1001,+,1000S500M,60,0;'],
    [0],
  )
  expect([...junctions.values()]).toEqual([{ start: 1000, end: 1500, n: 1 }])
})

test('a piece on another chromosome breaks the adjacency it sits between', () => {
  const junctions = computeBackSpliceJunctions(
    'chr1',
    [read(5000, 5050, 1)],
    ['chr5,101,+,50S50M50S,60,0;chr1,1001,+,100S50M,60,0;'],
    [0],
  )
  expect(junctions.size).toBe(0)
})

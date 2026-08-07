import { buildCoverageTooltipBin } from '@jbrowse/alignments-core'

import { computeMafCoverage } from './computeMafCoverage.ts'
import { packTestWire } from './testWire.ts'

import type { TestWireBlock } from './testWire.ts'

function block(
  startBp: number,
  refSeq: string,
  rows: { sampleId: string; sample: string }[],
): TestWireBlock {
  return {
    startBp,
    refSeq,
    rows: rows.map(r => ({ sampleId: r.sampleId, seq: r.sample })),
  }
}

/**
 * Integration test: walk the same pipeline the model's `coverageTooltipBin`
 * view uses — compute the worker output, which already carries mismatches in
 * the MismatchArrays shape, then call `buildCoverageTooltipBin`. Locks in the
 * (position → depth + per-base counts) contract end-to-end.
 */
function makeBin(
  blocks: TestWireBlock[],
  regionStart: number,
  regionEnd: number,
) {
  const mafCov = computeMafCoverage(
    packTestWire(blocks),
    regionStart,
    regionEnd,
  )
  const { mismatchPositions, mismatchBases } = mafCov
  return (pos: number) =>
    buildCoverageTooltipBin(
      pos,
      { coverageDepths: mafCov.depths, coverageStartPos: mafCov.startPos },
      { mismatchPositions, mismatchBases },
    )
}

test('bin reports depth + per-base SNP counts for a mixed column', () => {
  const bin = makeBin(
    [
      block(10, 'ACGT', [
        { sampleId: '0', sample: 'ACGT' },
        { sampleId: '1', sample: 'ATGT' },
        { sampleId: '2', sample: 'AAGT' },
      ]),
    ],
    10,
    14,
  )(11)
  expect(bin?.depth).toBe(3)
  expect(bin?.snps).toEqual({
    T: { count: 1, fwd: 0, rev: 0 },
    A: { count: 1, fwd: 0, rev: 0 },
  })
})

test('bin is undefined when the position has zero depth', () => {
  const bin = makeBin(
    [block(10, 'A', [{ sampleId: '0', sample: '-' }])],
    10,
    11,
  )(10)
  expect(bin).toBeUndefined()
})

test('bin reports total samples but no snps when all match', () => {
  const bin = makeBin(
    [
      block(50, 'ACG', [
        { sampleId: '0', sample: 'ACG' },
        { sampleId: '1', sample: 'ACG' },
      ]),
    ],
    50,
    53,
  )(51)
  expect(bin?.depth).toBe(2)
  expect(bin?.snps).toEqual({})
})

import { buildCoverageTooltipBin } from '@jbrowse/alignments-core'

import { computeMafCoverage } from './computeMafCoverage.ts'

import type { MafBlock } from '../LinearMafRenderer/mafBackendTypes.ts'

const enc = new TextEncoder()

function block(
  startBp: number,
  refSeq: string,
  rows: { rowIndex: number; sample: string }[],
): MafBlock {
  return {
    startBp,
    refSeqBytes: enc.encode(refSeq),
    rows: rows.map(r => ({
      rowIndex: r.rowIndex,
      alignmentBytes: enc.encode(r.sample),
    })),
  }
}

/**
 * Integration test: walk the same pipeline the model's `coverageTooltipBin`
 * view uses — compute the worker output, pack mismatches into the
 * MismatchArrays shape, then call `buildCoverageTooltipBin`. Locks in the
 * (position → depth + per-base counts) contract end-to-end.
 */
function makeBin(blocks: MafBlock[], regionStart: number, regionEnd: number) {
  const mafCov = computeMafCoverage(blocks, regionStart, regionEnd)
  const mismatchPositions = new Uint32Array(mafCov.mismatches.length)
  const mismatchBases = new Uint8Array(mafCov.mismatches.length)
  for (let i = 0; i < mafCov.mismatches.length; i++) {
    const m = mafCov.mismatches[i]!
    mismatchPositions[i] = m.position
    mismatchBases[i] = m.base
  }
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
        { rowIndex: 0, sample: 'ACGT' },
        { rowIndex: 1, sample: 'ATGT' },
        { rowIndex: 2, sample: 'AAGT' },
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
    [block(10, 'A', [{ rowIndex: 0, sample: '-' }])],
    10,
    11,
  )(10)
  expect(bin).toBeUndefined()
})

test('bin reports total samples but no snps when all match', () => {
  const bin = makeBin(
    [
      block(50, 'ACG', [
        { rowIndex: 0, sample: 'ACG' },
        { rowIndex: 1, sample: 'ACG' },
      ]),
    ],
    50,
    53,
  )(51)
  expect(bin?.depth).toBe(2)
  expect(bin?.snps).toEqual({})
})

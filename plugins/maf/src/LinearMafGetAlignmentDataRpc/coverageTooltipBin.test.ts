import { buildCoverageTooltipBin } from '@jbrowse/alignments-core'

import { computeMafCoverage } from './computeMafCoverage.ts'

import type { MafWireBlock } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function block(
  startBp: number,
  refSeq: string,
  rows: { sampleId: string; sample: string }[],
): MafWireBlock {
  return {
    startBp,
    endBp: startBp + refSeq.replaceAll('-', '').length,
    refSeqBytes: enc.encode(refSeq),
    rows: rows.map(r => ({
      sampleId: r.sampleId,
      alignmentBytes: enc.encode(r.sample),
    })),
    empties: [],
  }
}

/**
 * Integration test: walk the same pipeline the model's `coverageTooltipBin`
 * view uses — compute the worker output, which already carries mismatches in
 * the MismatchArrays shape, then call `buildCoverageTooltipBin`. Locks in the
 * (position → depth + per-base counts) contract end-to-end.
 */
function makeBin(blocks: MafWireBlock[], regionStart: number, regionEnd: number) {
  const mafCov = computeMafCoverage(blocks, regionStart, regionEnd)
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

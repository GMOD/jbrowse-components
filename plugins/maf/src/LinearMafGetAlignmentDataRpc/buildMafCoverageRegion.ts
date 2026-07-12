import {
  computeInterbaseCoverage,
  computeSNPCoverage,
  packCoverageBinsCanvas2D,
  packCoverageSegmentsForGpu,
} from '@jbrowse/alignments-core'

import { computeMafCoverage } from './computeMafCoverage.ts'

import type {
  MafBlock,
  MafCoverageRegion,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

/**
 * Build the packed coverage region (depth bars + SNP segments + interbase
 * insertions + indicators) from MAF blocks. Called from the worker
 * (`LinearMafGetAlignmentData`) over the blocks it already narrowed to the
 * display/subtree row set, so coverage is automatically scoped to the visible
 * rows. Kept pure over its `blocks` argument so a subtree recompute would just
 * pass a filtered block list.
 *
 * `refRowIndex` (the reference assembly's display row) is forwarded to the
 * identity computation so the reference's self-match is excluded; `-1` when no
 * reference row is in the visible set.
 */
export function buildMafCoverageRegion(
  blocks: MafBlock[],
  regionStart: number,
  regionEnd: number,
  refRowIndex = -1,
): MafCoverageRegion {
  const mafCov = computeMafCoverage(blocks, regionStart, regionEnd, refRowIndex)
  const coverageForSnp = {
    depths: mafCov.depths,
    maxDepth: mafCov.maxDepth,
    startPos: mafCov.startPos,
  }

  // mismatch + insertion event arrays for the hover tooltips (MismatchArrays /
  // InterbaseArrays shapes consumed by alignments-core). The mismatch arrays
  // also feed computeSNPCoverage directly, so the object list isn't iterated
  // a second time.
  const mmCount = mafCov.mismatches.length
  const mismatchPositions = new Uint32Array(mmCount)
  const mismatchBases = new Uint8Array(mmCount)
  for (let i = 0; i < mmCount; i++) {
    const m = mafCov.mismatches[i]!
    mismatchPositions[i] = m.position
    mismatchBases[i] = m.base
  }

  const snpCoverage = computeSNPCoverage(
    mismatchPositions,
    mismatchBases,
    coverageForSnp,
  )
  const interbaseCoverage = computeInterbaseCoverage(
    mafCov.insertions,
    [],
    [],
    regionStart,
    coverageForSnp,
  )

  const insCount = mafCov.insertions.length
  const insertionPositions = new Uint32Array(insCount)
  const insertionLengths = new Uint32Array(insCount)
  for (let i = 0; i < insCount; i++) {
    const ins = mafCov.insertions[i]!
    insertionPositions[i] = ins.position
    insertionLengths[i] = ins.length
  }

  return {
    coverageDepths: mafCov.depths,
    coverageStartPos: mafCov.startPos,
    coverageMaxDepth: mafCov.maxDepth,
    identityScores: mafCov.identity,
    mismatchPositions,
    mismatchBases,
    insertionPositions,
    insertionLengths,
    coveragePackedBuffer: packCoverageBinsCanvas2D(
      mafCov.depths,
      mafCov.startPos,
    ),
    interbaseMaxCount: interbaseCoverage.maxCount,
    ...packCoverageSegmentsForGpu(snpCoverage, interbaseCoverage),
  }
}

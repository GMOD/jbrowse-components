import {
  computeInterbaseCoverage,
  computeSNPCoverage,
  packCoverageBinsCanvas2D,
  packCoverageSegmentsForGpu,
} from '@jbrowse/alignments-core'

import { computeMafCoverage } from './computeMafCoverage.ts'

import type { MafCoverageRegion } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafWireBlocksInput } from './computeMafCoverage.ts'

/**
 * Build the packed coverage region (depth bars + SNP segments + interbase
 * insertions + indicators) from packed MAF blocks. Called from the worker
 * (`LinearMafGetAlignmentData`) over the rows it already narrowed to the
 * display/subtree row set, so coverage is automatically scoped to the visible
 * rows. Kept pure over its `packed` argument so a subtree recompute would just
 * pass a differently filtered pack.
 *
 * `refSampleId` (the reference assembly's own sample id) is forwarded to the
 * identity computation so the reference's self-match is excluded; undefined
 * when the reference is not one of the rows.
 */
export function buildMafCoverageRegion(
  packed: MafWireBlocksInput,
  regionStart: number,
  regionEnd: number,
  refSampleId?: string,
): MafCoverageRegion {
  const mafCov = computeMafCoverage(packed, regionStart, regionEnd, refSampleId)
  const coverageForSnp = {
    depths: mafCov.depths,
    maxDepth: mafCov.maxDepth,
    startPos: mafCov.startPos,
  }

  // mismatch + insertion event arrays for the hover tooltips (MismatchArrays /
  // InterbaseArrays shapes consumed by alignments-core). `computeMafCoverage`
  // emits the mismatch arrays in their final packed form, so they feed
  // computeSNPCoverage and the client payload with no repacking pass.
  const { mismatchPositions, mismatchBases } = mafCov

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

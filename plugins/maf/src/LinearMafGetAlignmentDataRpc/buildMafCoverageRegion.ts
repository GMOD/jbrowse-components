import {
  computeInterbaseCoverage,
  computeSNPCoverage,
  coverageSegmentBuffers,
  packCoverageBinsForGpu,
  positionOrder,
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

  // Ascending by position, which `countInterbaseAtPosition` requires: it
  // binary-searches this array (as MAF's single interbase block) rather than
  // building a side index, so read-order input would return a plausible wrong
  // insertion tally instead of failing. Sorted rather than assumed, for the same
  // reason `MismatchWriter.finish` sorts — the walk's ordering is a property of
  // nested loops elsewhere.
  const insCount = mafCov.insertions.length
  const rawInsPositions = new Uint32Array(insCount)
  for (let i = 0; i < insCount; i++) {
    rawInsPositions[i] = mafCov.insertions[i]!.position
  }
  const { order: insOrder, sorted: insertionPositions } =
    positionOrder(rawInsPositions)
  const insertionLengths = new Uint32Array(insCount)
  for (let i = 0; i < insCount; i++) {
    insertionLengths[i] = mafCov.insertions[insOrder[i]!]!.length
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
    // The GPU layout (relDepth against the region's own peak), which is what
    // render-core's shared depth-bar pass uploads. Per-bp — `binSize` 1 — since
    // MAF's region is already bounded by `derivedRegionTooLarge` and never
    // downsampled the way the pileup's bin cap does.
    coveragePackedBuffer: packCoverageBinsForGpu(
      mafCov.depths,
      mafCov.maxDepth,
      mafCov.startPos,
      mafCov.depths.length,
    ),
    interbaseMaxCount: interbaseCoverage.maxCount,
    ...coverageSegmentBuffers(snpCoverage, interbaseCoverage),
  }
}

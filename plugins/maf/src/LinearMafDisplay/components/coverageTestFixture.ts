import { emptyCanvas2DCoverageBuffer } from '@jbrowse/alignments-core'

import type { MafCoverageRegion } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

/**
 * Zero-data coverage region for tests that exercise block/row logic only (the
 * coverage band itself is not under test). Single source for the
 * `MafCoverageRegion` shape so adding a field doesn't ripple across fixtures.
 */
export function emptyMafCoverage(coverageStartPos = 0): MafCoverageRegion {
  return {
    coverageDepths: new Float32Array(0),
    coverageStartPos,
    coverageMaxDepth: 0,
    identityScores: new Float32Array(0),
    matchesPerRow: new Float32Array(0),
    classifiablePerRow: new Float32Array(0),
    mismatchPositions: new Uint32Array(0),
    mismatchBases: new Uint8Array(0),
    insertionPositions: new Uint32Array(0),
    insertionLengths: new Uint32Array(0),
    coveragePackedBuffer: emptyCanvas2DCoverageBuffer(),
    snpPackedBuffer: new ArrayBuffer(0),
    interbasePackedBuffer: new ArrayBuffer(0),
    interbaseMaxCount: 0,
    indicatorPackedBuffer: new ArrayBuffer(0),
  }
}

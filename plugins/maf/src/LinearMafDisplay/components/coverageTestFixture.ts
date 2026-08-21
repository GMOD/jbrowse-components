import { emptyCanvas2DCoverageBuffer } from '@jbrowse/alignments-core'

import type {
  MafCoverageRegion,
  MafWireRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

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

/**
 * Zero-data wire payload, for a test whose fetch has to answer but whose data is
 * not what it is about. `LinearMafGetAlignmentData` always builds one of these,
 * so a mock resolving `{ regionData: undefined }` was answering a shape the RPC
 * cannot produce — and `setRpcData` stored it, leaving every reader of
 * `wireDataMap` reading through it.
 */
export function emptyMafWireRegionData(): MafWireRegionData {
  const u32 = () => new Uint32Array(0)
  return {
    arena: new Uint8Array(0),
    rowOffset: u32(),
    rowLength: u32(),
    rowSample: u32(),
    rowChr: u32(),
    rowStart: u32(),
    rowStrand: new Int8Array(0),
    rowSrcSize: u32(),
    blockStartBp: u32(),
    blockEndBp: u32(),
    blockRefOffset: u32(),
    blockRefLength: u32(),
    blockRowStart: u32(),
    blockEmptyStart: u32(),
    emptySample: u32(),
    emptyChr: u32(),
    emptyStatus: new Uint8Array(0),
    emptyStart: u32(),
    emptySize: u32(),
    emptyStrand: new Int8Array(0),
    emptySrcSize: u32(),
    sampleIds: [],
    chrNames: [],
    coverage: emptyMafCoverage(),
  }
}

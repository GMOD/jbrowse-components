import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface SoftclipRegionFields {
  softclipPositions: Uint32Array
  softclipYs: Uint16Array
  softclipLengths: Uint16Array
  softclipFrequencies: Uint8Array
  numSoftclips: number
}

// Slices the merged interbase array's softclip segment ([insEnd, scEnd)).
export function buildSoftclipFields(
  data: CigarUploadData,
): SoftclipRegionFields {
  const { insEnd, scEnd } = interbaseRangeEnds(data)
  return {
    softclipPositions: data.interbasePositions.subarray(insEnd, scEnd),
    softclipYs: data.interbaseYs.subarray(insEnd, scEnd),
    softclipLengths: data.interbaseLengths.subarray(insEnd, scEnd),
    softclipFrequencies: data.interbaseFrequencies.subarray(insEnd, scEnd),
    numSoftclips: data.numSoftclips,
  }
}

export function emptySoftclipFields(): SoftclipRegionFields {
  return {
    softclipPositions: new Uint32Array(0),
    softclipYs: new Uint16Array(0),
    softclipLengths: new Uint16Array(0),
    softclipFrequencies: new Uint8Array(0),
    numSoftclips: 0,
  }
}

// Per-base letters drawn inside softclip bars when showSoftClipping is on.
// Separate from SoftclipRegionFields because the base-letter arrays only
// populate in showSoftClipping mode while the bars always render.
export interface SoftclipBaseRegionFields {
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
  numSoftclipBases: number
}

export function buildSoftclipBaseFields(
  data: CigarUploadData,
): SoftclipBaseRegionFields {
  return {
    softclipBasePositions: data.softclipBasePositions,
    softclipBaseYs: data.softclipBaseYs,
    softclipBaseBases: data.softclipBaseBases,
    numSoftclipBases: data.softclipBasePositions.length,
  }
}

export function emptySoftclipBaseFields(): SoftclipBaseRegionFields {
  return {
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    numSoftclipBases: 0,
  }
}

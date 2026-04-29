import { interbaseRangeEnds } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { CigarUploadData } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface HardclipRegionFields {
  hardclipPositions: Uint32Array
  hardclipYs: Uint16Array
  hardclipLengths: Uint16Array
  hardclipFrequencies: Uint8Array
  numHardclips: number
}

// Slices the merged interbase array's hardclip segment ([scEnd, hcEnd)).
export function buildHardclipFields(
  data: CigarUploadData,
): HardclipRegionFields {
  const { scEnd, hcEnd } = interbaseRangeEnds(data)
  return {
    hardclipPositions: data.interbasePositions.subarray(scEnd, hcEnd),
    hardclipYs: data.interbaseYs.subarray(scEnd, hcEnd),
    hardclipLengths: data.interbaseLengths.subarray(scEnd, hcEnd),
    hardclipFrequencies: data.interbaseFrequencies.subarray(scEnd, hcEnd),
    numHardclips: data.numHardclips,
  }
}

export function emptyHardclipFields(): HardclipRegionFields {
  return {
    hardclipPositions: new Uint32Array(0),
    hardclipYs: new Uint16Array(0),
    hardclipLengths: new Uint16Array(0),
    hardclipFrequencies: new Uint8Array(0),
    numHardclips: 0,
  }
}

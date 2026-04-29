import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as readShader from '../../shaders/slang/read.generated.ts'

import type { ReadUploadData } from '../../shared/uploadTypes.ts'

export const PASS_READ = 'read'

export const READ_PASS = slangPass({ id: PASS_READ, mod: readShader })

// Pure: pack per-segment instances for the read pass. Hot loop over
// thousands of segments — all host-object property accesses are hoisted
// to locals so V8 reads through typed-array views directly.
export function packReadSegments(data: ReadUploadData): ArrayBuffer {
  const n = data.numSegments
  const stride32 = readShader.INSTANCE_STRIDE_F32
  const F = readShader.FIELD_OFFSET_F32
  const buf = new ArrayBuffer(n * readShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const tagColors = data.readTagColors
  const hasTagColors = tagColors.length > 0
  const chainHasSupp = data.readChainHasSupp
  const readPositions = data.readPositions
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readAvgBaseQualities = data.readAvgBaseQualities
  const readInsertSizes = data.readInsertSizes
  const readPairOrientations = data.readPairOrientations
  const readStrands = data.readStrands
  const segmentPositions = data.segmentPositions
  const segmentReadIndices = data.segmentReadIndices
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let j = 0; j < n; j++) {
    const ri = segmentReadIndices[j]!
    const o = j * stride32
    u32[o + F.startOff] = segmentPositions[j * 2]!
    u32[o + F.endOff] = segmentPositions[j * 2 + 1]!
    u32[o + F.y] = readYs[ri]!
    u32[o + F.flags] = readFlags[ri]!
    u32[o + F.mapq] = readMapqs[ri]!
    u32[o + F.baseQuality] = readAvgBaseQualities[ri]!
    f32[o + F.insertSize] = readInsertSizes[ri]!
    u32[o + F.pairOrient] = readPairOrientations[ri]!
    i32[o + F.strand] = readStrands[ri]!
    u32[o + F.tagColor] = hasTagColors ? tagColors[ri]! : 0
    u32[o + F.chainHasSupp] = chainHasSupp ? chainHasSupp[ri]! : 0
    u32[o + F.readIndex] = ri
    u32[o + F.edgeFlags] = segmentEdgeFlags[j]!
    u32[o + F.readStartOff] = readPositions[ri * 2]!
    u32[o + F.readEndOff] = readPositions[ri * 2 + 1]!
  }
  return buf
}

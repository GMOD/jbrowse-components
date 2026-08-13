import * as readShader from '../../shaders/slang/read.generated.ts'
import { instancePass } from '../../shared/instancePass.ts'

import type { ReadUploadData } from '../../shared/uploadTypes.ts'

export const PASS_READ = 'read'

export const READ_PASS = instancePass({
  id: PASS_READ,
  mod: readShader,
  pack: packReadSegments,
})

// Pure: pack per-segment instances for the read pass. Hot loop over
// thousands of segments — all host-object property accesses are hoisted
// to locals so V8 reads through typed-array views directly.
export function packReadSegments(data: ReadUploadData): ArrayBuffer {
  const n = data.numSegments
  const stride32 = readShader.INSTANCE_STRIDE_WORDS
  const F_F32 = readShader.INSTANCE_OFFSET_F32
  const F_I32 = readShader.INSTANCE_OFFSET_I32
  const F_U32 = readShader.INSTANCE_OFFSET_U32
  const buf = new ArrayBuffer(n * readShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const tagColors = data.readTagColors
  const hasTagColors = tagColors.length > 0
  const colorCategories = data.readColorCategories
  const interchrom = data.readInterchrom
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readInsertSizes = data.readInsertSizes
  const readStrands = data.readStrands
  const segmentPositions = data.segmentPositions
  const segmentReadIndices = data.segmentReadIndices
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let j = 0; j < n; j++) {
    const ri = segmentReadIndices[j]!
    const o = j * stride32
    u32[o + F_U32.startOff] = segmentPositions[j * 2]!
    u32[o + F_U32.endOff] = segmentPositions[j * 2 + 1]!
    u32[o + F_U32.y] = readYs[ri]!
    u32[o + F_U32.flags] = readFlags[ri]!
    u32[o + F_U32.mapq] = readMapqs[ri]!
    f32[o + F_F32.insertSize] = readInsertSizes[ri]!
    i32[o + F_I32.strand] = readStrands[ri]!
    u32[o + F_U32.tagColor] = hasTagColors ? tagColors[ri]! : 0
    u32[o + F_U32.edgeFlags] = segmentEdgeFlags[j]!
    u32[o + F_U32.interchrom] = interchrom[ri]!
    u32[o + F_U32.colorCategory] = colorCategories[ri]!
  }
  return buf
}

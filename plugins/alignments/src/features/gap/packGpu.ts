import { slangPass } from '@jbrowse/render-core/slangPass'

import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import * as gapShader from '../../shaders/slang/gap.generated.ts'

import type { GapTypeCode, GapUploadData } from './types.ts'

// Two passes over one worker payload and one shader. The split is a VISIBILITY
// decision rather than a geometric one: `showMismatches` takes the deletion bars
// and leaves the intron centerlines, which are the other half of the read pass's
// decision to split a spliced read at its N gaps (`buildSegmentArrays`). See
// PILEUP_LAYERS.
//
// Separate buffers rather than one buffer drawn twice, because a pass id keys
// the instance buffer as well as the pipeline: sharing one would draw every gap
// under both gates. Each packer takes its own kind out of `gapTypes`, so the two
// buffers together still hold each gap exactly once.
export const DELETION_PASS = {
  ...slangPass({ id: 'deletion', mod: gapShader }),
  pack: (data: GapUploadData) => packGapsOfType(data, GAP_DELETION),
}

export const SKIP_PASS = {
  ...slangPass({ id: 'skip', mod: gapShader }),
  pack: (data: GapUploadData) => packGapsOfType(data, GAP_SKIP),
}

export function packGapsOfType(data: GapUploadData, gapType: GapTypeCode) {
  const { gapPositions, gapYs, gapTypes, gapFrequencies } = data
  const numGaps = gapPositions.length / 2
  // Counted rather than over-allocated: `uploadPass` reads the instance count
  // off the buffer's own byteLength, so trailing capacity would draw.
  let n = 0
  for (let i = 0; i < numGaps; i++) {
    if (gapTypes[i] === gapType) {
      n++
    }
  }
  const F_F32 = gapShader.INSTANCE_OFFSET_F32
  const F_U32 = gapShader.INSTANCE_OFFSET_U32
  const s32 = gapShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * gapShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = 0; i < numGaps; i++) {
    if (gapTypes[i] !== gapType) {
      continue
    }
    u32[o + F_U32.startOff] = gapPositions[i * 2]!
    u32[o + F_U32.endOff] = gapPositions[i * 2 + 1]!
    u32[o + F_U32.y] = gapYs[i]!
    // The shader still branches on it: one `.slang` serves both passes, so the
    // attribute conveys which branch even though it is constant per buffer.
    u32[o + F_U32.gapType] = gapType
    f32[o + F_F32.frequency] = gapFrequencies[i]! / 255
    o += s32
  }
  return buf
}

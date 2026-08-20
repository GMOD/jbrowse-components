import { slangPass } from '@jbrowse/render-core/slangPass'

import * as clipShader from '../../shaders/slang/clip.generated.ts'
import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'

// Per-instance kind discriminator written into the clip pass — same shader
// renders both soft and hard clips, branching on `kind` for color.
const CLIP_KIND_SOFT = 0
const CLIP_KIND_HARD = 1

export const CLIP_PASS = {
  ...slangPass({
    id: 'clip',
    mod: clipShader,
  }),
  pack: packClips,
}

// Worker lays out interbases as (insertions, softclips, hardclips); pack
// soft+hard together into a single instanced draw with a per-instance kind.
export function packClips(data: CigarUploadData): ArrayBuffer {
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(data)
  const count = data.numSoftclips + data.numHardclips
  const F_F32 = clipShader.INSTANCE_OFFSET_F32
  const F_U32 = clipShader.INSTANCE_OFFSET_U32
  const s32 = clipShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(count * clipShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.interbasePositions
  const ys = data.interbaseYs
  const freq = data.interbaseFrequencies
  for (let i = insEnd; i < hcEnd; i++) {
    const o = (i - insEnd) * s32
    u32[o + F_U32.position] = pos[i]!
    u32[o + F_U32.y] = ys[i]!
    f32[o + F_F32.frequency] = freq[i]! / 255
    u32[o + F_U32.kind] = i < scEnd ? CLIP_KIND_SOFT : CLIP_KIND_HARD
  }
  return buf
}

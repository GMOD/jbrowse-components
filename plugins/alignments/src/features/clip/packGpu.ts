import { slangPass } from '@jbrowse/render-core/slangPass'

import * as clipShader from '../../shaders/slang/clip.generated.ts'
import { countMarks, markEnd, markStart } from '../mark.ts'
import { HARDCLIP_MARK, SOFTCLIP_MARK } from './mark.ts'

import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { PointMark } from '../mark.ts'

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

// Soft and hard clips pack into a single instanced draw with a per-instance
// kind, one mark after the other so the buffer keeps the array's own order —
// which is the order the two hit scans read it in.
export function packClips(data: InterbaseUploadData): ArrayBuffer {
  const count =
    countMarks(SOFTCLIP_MARK, data) + countMarks(HARDCLIP_MARK, data)
  const buf = new ArrayBuffer(count * clipShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const after = packClipKind(SOFTCLIP_MARK, CLIP_KIND_SOFT, data, u32, f32, 0)
  packClipKind(HARDCLIP_MARK, CLIP_KIND_HARD, data, u32, f32, after)
  return buf
}

function packClipKind(
  mark: PointMark<InterbaseUploadData>,
  kind: number,
  data: InterbaseUploadData,
  u32: Uint32Array,
  f32: Float32Array,
  offset: number,
) {
  const F_F32 = clipShader.INSTANCE_OFFSET_F32
  const F_U32 = clipShader.INSTANCE_OFFSET_U32
  const s32 = clipShader.INSTANCE_STRIDE_WORDS
  const rows = mark.rows(data)
  const end = markEnd(mark, data, rows)
  let o = offset
  for (let i = markStart(mark, data); i < end; i++) {
    if (mark.selects(data, i)) {
      u32[o + F_U32.position] = mark.startBp(data, i)
      u32[o + F_U32.y] = rows[i]!
      f32[o + F_F32.frequency] = data.interbaseFrequencies[i]! / 255
      u32[o + F_U32.kind] = kind
      o += s32
    }
  }
  return o
}

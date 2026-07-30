import { slangPass } from '@jbrowse/render-core/slangPass'

import * as clipShader from '../LinearAlignmentsDisplay/shaders/slang/clip.generated.ts'
import { INTERBASE_HARDCLIP, INTERBASE_SOFTCLIP } from './types.ts'
import { interbaseRangeEnds } from './uploadTypes.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from './hitTestTypes.ts'
import type { CigarUploadData } from './uploadTypes.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

export const PASS_CLIP = 'clip'

// Per-instance kind discriminator written into the clip pass — same shader
// renders both soft and hard clips, branching on `kind` for color.
export const CLIP_KIND_SOFT = 0
export const CLIP_KIND_HARD = 1

export const CLIP_PASS = slangPass({
  id: PASS_CLIP,
  mod: clipShader,
})

// Worker lays out interbases as (insertions, softclips, hardclips); pack
// soft+hard together into a single instanced draw with a per-instance kind.
export function packClips(data: CigarUploadData): ArrayBuffer {
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(data)
  const count = data.numSoftclips + data.numHardclips
  const F = clipShader.FIELD_OFFSET_F32
  const s32 = clipShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(count * clipShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.interbasePositions
  const ys = data.interbaseYs
  const freq = data.interbaseFrequencies
  for (let i = insEnd; i < hcEnd; i++) {
    const o = (i - insEnd) * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    f32[o + F.frequency] = freq[i]! / 255
    u32[o + F.kind] = i < scEnd ? CLIP_KIND_SOFT : CLIP_KIND_HARD
  }
  return buf
}

export function uploadClips(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: CigarUploadData,
) {
  const count = data.numSoftclips + data.numHardclips
  if (count > 0) {
    hal.uploadBuffer(displayedRegionIndex, PASS_CLIP, packClips(data), count)
  }
}

// Hit test for soft + hard clips in one pass. Both bars live in the same merged
// interbase array and differ only by `interbaseTypes[i]`, so the entry already
// names which kind was hit — no need to scan once per kind.
//
// Softclip still wins a tie, structurally rather than by scan order: the worker
// lays the array out as (insertions, softclips, hardclips), so a softclip at this
// row and position is always reached first.
export function hitTestClip(
  resolved: ResolvedBlock,
  coords: CigarCoords,
): CigarHitResult | undefined {
  const { bpPerPx, genomicPos, row } = coords
  const { interbasePositions, interbaseYs, interbaseLengths, interbaseTypes } =
    resolved.rpcData
  const numInterbases = interbasePositions.length
  const hitToleranceBp = Math.max(0.5, bpPerPx * 3)

  for (let i = 0; i < numInterbases; i++) {
    const type = interbaseTypes[i]
    const isClip = type === INTERBASE_SOFTCLIP || type === INTERBASE_HARDCLIP
    if (!isClip || interbaseYs[i] !== row) {
      continue
    }
    const pos = interbasePositions[i]
    const len = interbaseLengths[i]
    if (
      pos !== undefined &&
      len !== undefined &&
      Math.abs(genomicPos - pos) < hitToleranceBp
    ) {
      return {
        type: type === INTERBASE_SOFTCLIP ? 'softclip' : 'hardclip',
        index: i,
        position: pos,
        length: len,
      }
    }
  }
  return undefined
}

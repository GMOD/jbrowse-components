import { slangPass } from '@jbrowse/render-core/slangPass'

import { passesFrequencyGate } from '../LinearAlignmentsDisplay/constants.ts'
import * as clipShader from '../LinearAlignmentsDisplay/shaders/slang/clip.generated.ts'
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

// Hit test for soft + hard clips in one pass, over the same `[insEnd, hcEnd)`
// slice `packClips` uploads and deriving the kind from the same `i < scEnd`
// boundary — so a bar's hit kind and its drawn color cannot disagree.
//
// Softclip wins a tie structurally rather than by scan order, for the same
// reason: the worker lays the array out as (insertions, softclips, hardclips),
// so a softclip at this row and position is always reached first.
export function hitTestClip(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const { bpPerPx, genomicPos, row } = coords
  const {
    interbasePositions,
    interbaseYs,
    interbaseLengths,
    interbaseFrequencies,
  } = resolved.rpcData
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(resolved.rpcData)
  const hitToleranceBp = Math.max(0.5, bpPerPx * 3)

  for (let i = insEnd; i < hcEnd; i++) {
    if (interbaseYs[i] !== row) {
      continue
    }
    // Same significance gate as the mismatch and small-insertion tests, off the
    // same `interbaseFrequencies` byte the clip shader fades by (clip.slang's
    // `frequencyFade`). This test was the one mark hit-test without it, so a
    // clip faded to the noise floor still intercepted clicks that every other
    // faded mark hands back to the read body underneath.
    if (
      !passesFrequencyGate(
        bpPerPx,
        interbaseFrequencies[i] ?? 0,
        filterMismatchesByFrequency,
      )
    ) {
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
        type: i < scEnd ? 'softclip' : 'hardclip',
        index: i,
        position: pos,
        length: len,
      }
    }
  }
  return undefined
}

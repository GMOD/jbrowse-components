import { slangPass } from '@jbrowse/render-core/slangPass'

import { passesFrequencyGate } from '../LinearAlignmentsDisplay/constants.ts'
import * as clipShader from '../shaders/slang/clip.generated.ts'
import { findTopmostOnRow } from './hitTestTypes.ts'
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

// Hit test for soft + hard clips, over the same `[insEnd, hcEnd)` slice
// `packClips` uploads and split on the same `scEnd` boundary — so a bar's hit
// kind and its drawn color cannot disagree.
//
// TWO scans, softclips then hardclips, because two independent rules meet here
// and one loop could only express one of them:
//
//   - **Softclip beats hardclip** at the same row and position. That is the
//     worker's array layout (insertions, softclips, hardclips) talking, not scan
//     order, so it is the order the two calls are written in.
//   - **Within a kind, the topmost bar wins** — `findTopmostOnRow`, same as
//     every other mark test, which matters where a collapsed group or a chain
//     puts several reads on one row.
//
// Fused into one forward loop those two disagreed: the second rule silently
// became "whichever read comes first in the array", i.e. the bar underneath.
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

  const matches = (i: number) => {
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
      return false
    }
    const pos = interbasePositions[i]
    const len = interbaseLengths[i]
    return (
      pos !== undefined &&
      len !== undefined &&
      Math.abs(genomicPos - pos) < hitToleranceBp
    )
  }

  const soft = findTopmostOnRow(interbaseYs, insEnd, scEnd, row, matches)
  const i = soft ?? findTopmostOnRow(interbaseYs, scEnd, hcEnd, row, matches)
  return i === undefined
    ? undefined
    : {
        type: i < scEnd ? 'softclip' : 'hardclip',
        index: i,
        position: interbasePositions[i]!,
        length: interbaseLengths[i]!,
      }
}

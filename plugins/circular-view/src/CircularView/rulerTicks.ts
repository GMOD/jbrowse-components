import { getTickDisplayStr, toLocale } from '@jbrowse/core/util'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'

import { bpToRadians } from './slices.ts'

import type { Slice } from './slices.ts'

// the least arc, in css px at the ruler, between two labelled ticks and
// between any two
const MAJOR_PITCH_PX = 80
const MINOR_PITCH_PX = 12

export interface RulerTick {
  /** 1-based, the base whose left edge the tick marks */
  base: number
  radians: number
  /** set on a major tick: the base as the linear view's scalebar writes it */
  label?: string
}

/**
 * A slice's base-pair ticks: one at every multiple of the pitch its arc
 * affords, a label on each major one, on the 1/2/5 ladder the linear view's
 * scalebar uses. An elided slice has none.
 *
 * A slice that closes the ring on itself (`seam`) has no gap to show where it
 * starts, so its first base gets a labelled tick too, and a major tick too
 * close to share the seam's room goes unlabelled.
 */
export function rulerTicks(
  slice: Slice,
  radiusPx: number,
  seam = false,
): RulerTick[] {
  const { region } = slice
  if (region.elided) {
    return []
  }
  const bpPerPx = slice.bpPerRadian / radiusPx
  const { majorPitch, minorPitch } = chooseGridPitch(
    bpPerPx,
    MAJOR_PITCH_PX,
    MINOR_PITCH_PX,
  )
  const pitch = minorPitch || majorPitch
  const first = region.start + 1
  const ticks: RulerTick[] = seam
    ? [
        {
          base: first,
          radians: bpToRadians(slice, region.start),
          label: toLocale(first),
        },
      ]
    : []
  // the seam is both the first base's left edge and the last base's right
  const nearSeam = (base: number) =>
    seam &&
    Math.min(base - 1 - region.start, region.end - base + 1) < majorPitch / 2
  for (
    let base = Math.ceil(first / pitch) * pitch;
    base <= region.end;
    base += pitch
  ) {
    if (!seam || base !== first) {
      ticks.push({
        base,
        radians: bpToRadians(slice, base - 1),
        label:
          base % majorPitch || nearSeam(base)
            ? undefined
            : getTickDisplayStr(base, bpPerPx),
      })
    }
  }
  return ticks
}

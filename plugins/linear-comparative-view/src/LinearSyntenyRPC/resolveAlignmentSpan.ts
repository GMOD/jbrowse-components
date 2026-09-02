import {
  findPosInCigar,
  findPosInCigarByMate,
} from '../LaunchSyntenyView/findPosInCigar.ts'
import { getAlignmentOps, getMate } from '../syntenyMate.ts'

import type { Feature } from '@jbrowse/core/util'

export interface SpanOfInterest {
  start: number
  end: number
}

export interface ResolvedSpan {
  refName: string
  start: number
  end: number
}

/**
 * The slice of the OTHER axis that `alignment` puts opposite `window`, walked
 * through the CIGAR — or through the coarse tier's fold of it, whose runs keep
 * the answer within the fold's `--coarse` gap (ADR-103).
 *
 * `undefined` when the block carries neither, and that is the point of this
 * function rather than a shortcoming of it. Interpolating across the block is
 * available (`buildSyntenyViewSpec`'s `resolveSpans` does it, and for a launch
 * that is padded by a window size it is fine), but a caller that is going to
 * NAVIGATE a panel to the result and show it flush against its neighbour would
 * be presenting a straight-line guess as a correspondence, and a straight line
 * across a whole block has no error bound at all. So the honest answer is no
 * answer.
 *
 * `toMate` picks the direction: true maps a window on the feature (target) axis
 * onto the mate (query) axis, false maps the mate axis onto the feature axis.
 * Both directions are a walk, not each other's arithmetic inverse — the two
 * axes advance at different rates through indels.
 */
export function resolveAlignmentSpan({
  alignment,
  window,
  toMate,
}: {
  alignment: Feature
  window: SpanOfInterest
  toMate: boolean
}): ResolvedSpan | undefined {
  const mate = getMate(alignment)
  const cigar = getAlignmentOps(alignment)
  if (!mate || !cigar) {
    return undefined
  }
  const strand = alignment.get('strand')
  const featStart = alignment.get('start')
  const featEnd = alignment.get('end')

  // clamped to the block first, so a window wider than the alignment (or one
  // starting left of it) lands back on the block's own ends rather than
  // walking off either side
  const clamp = (x: number, lo: number, hi: number) =>
    Math.min(Math.max(x, lo), hi)

  if (toMate) {
    const lo = clamp(window.start, featStart, featEnd)
    const hi = clamp(window.end, featStart, featEnd)
    const [, mLo] = findPosInCigar(cigar, lo - featStart)
    const [, mHi] = findPosInCigar(cigar, hi - featStart)
    // a reverse-strand walk counts down from the mate's far end, so the two
    // ends arrive swapped
    const a = strand === -1 ? mate.end - mLo : mate.start + mLo
    const b = strand === -1 ? mate.end - mHi : mate.start + mHi
    return {
      refName: mate.refName,
      start: Math.floor(Math.min(a, b)),
      end: Math.ceil(Math.max(a, b)),
    }
  }

  // The mate axis is stored genomically but walked as an offset from whichever
  // end the alignment starts at, so a reverse-strand block's window has to be
  // turned back into offsets before the walk and comes out swapped.
  const lo = clamp(window.start, mate.start, mate.end)
  const hi = clamp(window.end, mate.start, mate.end)
  const offset = (x: number) => (strand === -1 ? mate.end - x : x - mate.start)
  const oLo = Math.min(offset(lo), offset(hi))
  const oHi = Math.max(offset(lo), offset(hi))
  const [fLo] = findPosInCigarByMate(cigar, oLo)
  const [fHi] = findPosInCigarByMate(cigar, oHi)
  return {
    refName: alignment.get('refName'),
    start: Math.floor(featStart + Math.min(fLo, fHi)),
    end: Math.ceil(featStart + Math.max(fLo, fHi)),
  }
}

import { assembleLocString } from '@jbrowse/core/util'

// Pad a whole-base span by windowSize and render it as a locstring.
// assembleLocString is what makes this 1-based: navToLocString parses the result
// back as 1-based inclusive, so emitting the raw interbase start would open the
// view one base left of the alignment. The rounding is `resolvePanel`'s, not
// this function's — the values arriving here are already whole and already
// ordered; the floor/ceil below only survive a fractional `windowSize`. The
// `end` floor keeps at least one base, since a zero-width span (windowSize 0
// over a single-base CIGAR mapping) would assemble into an inverted locstring.
export function paddedLocString({
  refName,
  start,
  end,
  windowSize,
  reversed,
}: {
  refName: string
  start: number
  end: number
  windowSize: number
  reversed?: boolean
}) {
  const lo = Math.max(0, Math.floor(start - windowSize))
  return assembleLocString({
    refName,
    start: lo,
    end: Math.max(lo + 1, Math.ceil(end + windowSize)),
    reversed,
  })
}

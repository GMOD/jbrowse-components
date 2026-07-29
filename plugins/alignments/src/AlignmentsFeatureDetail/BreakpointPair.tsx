import { formatEndLocation, formatStartLocation } from '../shared/locStrings.ts'

import type { ReducedFeature } from './getSAFeatures.ts'

/**
 * A segment's two junctions as displayed locations. Both are derived from the
 * segment's own interval here, so `strand` only chooses which is which and can
 * never change how a coordinate is converted.
 */
export function junctionLocations(f: ReducedFeature) {
  const first = formatStartLocation(f.refName, f.start)
  const last = formatEndLocation(f.refName, f.end)
  return f.strand === 1
    ? { upstream: first, downstream: last }
    : { upstream: last, downstream: first }
}

/**
 * "chr1:1,001 → chr2:2,002" — the from/to pair every breakpoint row in this
 * widget prints, whether the two sides are a read and its mate or two segments
 * of a split read.
 */
export default function BreakpointPair({
  from,
  to,
}: {
  from: string
  to: string
}) {
  return (
    <>
      {from} &rarr; {to}
    </>
  )
}

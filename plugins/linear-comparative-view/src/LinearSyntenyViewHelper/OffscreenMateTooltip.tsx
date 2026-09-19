import { getBpDisplayStr } from '@jbrowse/core/util'
import { ComparativeTooltip } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { offscreenMateTotals } from './offscreenMateStrip.ts'

import type {
  OffscreenMateHit,
  OffscreenMateSource,
} from './offscreenMateStrip.ts'

export interface OffscreenMateHover extends OffscreenMateHit {
  clientX: number
  clientY: number
}

export function offscreenMateClickHint(hit: OffscreenMateHit) {
  const panel = hit.side === 'top' ? 'panel below' : 'panel above'
  return hit.displayed
    ? `The ${panel} has scrolled off it. Click to scroll there`
    : `Not on the ${panel}. Click to add it`
}

// A stretch too narrow to carry a name is unlabelled, so the marks a reader
// most wants explained are those. Sequence leads, because that is what decides
// whether a mark is worth a click and what the strip ranks its names by, and
// the alignment count follows it: 920Kbp in 4 alignments and 920Kbp in 176 are
// different things to click into. The locus is not named — resolving it is a
// full scan of the lane, and this runs per pointer move.
const OffscreenMateTooltip = observer(function OffscreenMateTooltip({
  model,
  hover,
}: {
  model: OffscreenMateSource
  hover: OffscreenMateHover
}) {
  const { alignments, alignedBp } = offscreenMateTotals(
    model,
    hover.refName,
    hover.side,
  )
  return (
    <ComparativeTooltip
      clientPoint={{ x: hover.clientX, y: hover.clientY }}
      lines={[
        alignments > 0
          ? `${hover.refName} · ${getBpDisplayStr(alignedBp)} in ${alignments.toLocaleString()} alignments`
          : hover.refName,
        offscreenMateClickHint(hover),
      ]}
    />
  )
})

export default OffscreenMateTooltip

import { getBpDisplayStr } from '@jbrowse/core/util'
import { ComparativeTooltip } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { offscreenMateTotals } from './offscreenMateStrip.ts'

import type { OffscreenMateSide } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { MateNavDestination } from './offscreenMateNav.ts'
import type {
  OffscreenMateHit,
  OffscreenMateSource,
} from './offscreenMateStrip.ts'

export interface OffscreenMateHover extends OffscreenMateHit {
  clientX: number
  clientY: number
}

// What the click will do, read off the destination the click itself resolves,
// so the promise names the locus the snackbar will
export function offscreenMateClickHint(
  side: OffscreenMateSide,
  dest: MateNavDestination,
) {
  const panel = side === 'top' ? 'panel below' : 'panel above'
  return dest.kind === 'none'
    ? dest.reason
    : `Click to show ${dest.loc} on the ${panel}`
}

// A stretch too narrow to carry a name is unlabelled, so the marks a reader
// most wants explained are those. Sequence leads, because that is what decides
// whether a mark is worth a click and what the strip ranks its names by, and
// the alignment count follows it: 920Kbp in 4 alignments and 920Kbp in 176 are
// different things to click into.
const OffscreenMateTooltip = observer(function OffscreenMateTooltip({
  model,
  hover,
  destination,
}: {
  model: OffscreenMateSource
  hover: OffscreenMateHover
  destination: MateNavDestination | undefined
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
        ...(destination
          ? [offscreenMateClickHint(hover.side, destination)]
          : []),
      ]}
    />
  )
})

export default OffscreenMateTooltip

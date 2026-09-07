import { ComparativeTooltip } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { offscreenMateCount } from './offscreenMateStrip.ts'

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

// A label goes on a stretch only when it is wide enough to hold it, so the
// marks a reader most wants explained are the unlabelled ones. The locus is
// not named: resolving it is a full scan of the lane, and this runs per
// pointer move.
const OffscreenMateTooltip = observer(function OffscreenMateTooltip({
  model,
  hover,
}: {
  model: OffscreenMateSource
  hover: OffscreenMateHover
}) {
  const count = offscreenMateCount(model, hover.refName, hover.side)
  return (
    <ComparativeTooltip
      clientPoint={{ x: hover.clientX, y: hover.clientY }}
      lines={[
        count > 0
          ? `${hover.refName} · ${count.toLocaleString()} alignments`
          : hover.refName,
        offscreenMateClickHint(hover),
      ]}
    />
  )
})

export default OffscreenMateTooltip

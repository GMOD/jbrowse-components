import { ComparativeTooltip } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { offscreenMateCount } from './offscreenMateStrip.ts'

import type { OffscreenMateSource } from './offscreenMateStrip.ts'

export interface OffscreenMateHover {
  refName: string
  clientX: number
  clientY: number
}

/**
 * What the mark under the pointer stands for.
 *
 * THE NAME IS OFTEN NOT ON SCREEN. A label goes on a stretch only when the
 * stretch is wide enough to hold it, so the marks a reader most wants explained
 * — a narrow run, one anchor on its own — are exactly the unlabelled ones. Until
 * this the only way to find out where such a mark went was to click it, and the
 * click runs `navToLocString`, which REPLACES the facing panel's displayed
 * regions. That made the one destructive step in the feature the only way to
 * see what it would do.
 *
 * The count is the tally's, the same number the hamburger item reports for this
 * contig, so the two readouts of one fact cannot drift.
 *
 * `ComparativeTooltip` rather than a `BaseTooltip` of its own: a mark and a
 * ribbon are two things in one band, and a second tooltip shape over the same
 * strip of pixels reads as a second app. It also carries the `clientPoint`
 * discipline — an omitted one leaves floating-ui with no position until the
 * NEXT pointer move, so landing on a mark and stopping would show nothing.
 */
const OffscreenMateTooltip = observer(function OffscreenMateTooltip({
  model,
  hover,
}: {
  model: OffscreenMateSource
  hover: OffscreenMateHover
}) {
  const count = offscreenMateCount(model, hover.refName)
  return (
    <ComparativeTooltip
      clientPoint={{ x: hover.clientX, y: hover.clientY }}
      lines={[
        count > 0
          ? `${hover.refName} · ${count.toLocaleString()} alignments`
          : hover.refName,
        'Click to show it on the panel below',
      ]}
    />
  )
})

export default OffscreenMateTooltip

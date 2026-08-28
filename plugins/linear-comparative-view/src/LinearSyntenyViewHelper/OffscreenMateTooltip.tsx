import { ComparativeTooltip } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { offscreenMateCount } from './offscreenMateStrip.ts'

import type { OffscreenMateSide } from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { OffscreenMateSource } from './offscreenMateStrip.ts'

export interface OffscreenMateHover {
  refName: string
  // Which strip the pointer is in, which answers two things at once: whose
  // tally to count this contig against — the two lanes hold contigs of
  // different assemblies — and which panel a click would move, since a mark on
  // the query axis names a contig the panel BELOW is not showing and one on the
  // target axis names a contig the panel ABOVE is not.
  side: OffscreenMateSide
  clientX: number
  clientY: number
}

/**
 * What the mark under the pointer stands for.
 *
 * THE NAME IS OFTEN NOT ON SCREEN. A label goes on a stretch only when the
 * stretch is wide enough to hold it, so the marks a reader most wants explained
 * — a narrow run, one anchor on its own — are exactly the unlabelled ones, and
 * without this the only way to find out where one went was to click it and
 * look. That is a cheap thing to undo now and was not always: the click used to
 * REPLACE the facing panel's displayed regions, which made trying it the
 * destructive step.
 *
 * The count is the tally's, and this tooltip is the only place it is shown: the
 * hamburger item that used to report a per-contig count is gone, and the
 * settings menu's "Off-screen mates" radios carry a fixed label.
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
  const count = offscreenMateCount(model, hover.refName, hover.side)
  return (
    <ComparativeTooltip
      clientPoint={{ x: hover.clientX, y: hover.clientY }}
      lines={[
        count > 0
          ? `${hover.refName} · ${count.toLocaleString()} alignments`
          : hover.refName,
        // ONE SENTENCE FOR BOTH CLASSES. A mark whose contig the facing panel
        // already displays is scrolled to; one whose contig it does not is
        // ADDED to that panel and then framed. The two used to want different
        // wording because one of them discarded the panel's regions and the
        // reader deserved the warning; neither does now, so "show it" is the
        // whole of what a reader needs before clicking.
        //
        // THE LOCUS is still not named, deliberately: resolving which locus is
        // a full scan of the lane (`offscreenMateSpanAt`, 4.11ms on a 250k-mark
        // level) where this runs on a rAF per pointer move. The snackbar the
        // click raises names the contig it landed on.
        //
        // Naming the wrong panel describes a click that then moves the other.
        hover.side === 'top'
          ? 'Click to show it on the panel below'
          : 'Click to show it on the panel above',
      ]}
    />
  )
})

export default OffscreenMateTooltip

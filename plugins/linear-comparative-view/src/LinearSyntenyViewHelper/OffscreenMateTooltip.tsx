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
  // whether a click scrolls that panel or replaces what it is showing
  canScroll: boolean
  clientX: number
  clientY: number
}

// The two clicks in one sentence each. `canScroll` is the facing panel already
// displaying this contig, so the click only has to move it there.
function clickLine(side: OffscreenMateSide, canScroll: boolean) {
  const panel = side === 'top' ? 'panel below' : 'panel above'
  return canScroll
    ? `Click to scroll the ${panel} to it`
    : `Click to show it on the ${panel}, replacing what that panel shows`
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
        // WHICH OF THE TWO CLICKS THIS IS. One scrolls the facing panel, which
        // is reversible and acts immediately; the other replaces what that
        // panel is showing, and asks first. Nothing said which, so the only way
        // to find out was to do it — and the reader who most needs to know is
        // the one about to lose a region list they built.
        //
        // Free here, unlike the locus: the hit test already had the lane in
        // hand when it matched, while resolving WHERE on the contig is a full
        // scan (`offscreenMateSpanAt`, 4.11ms on a 250k-mark level) and this
        // runs on a rAF per pointer move. The dialog and the snackbar name the
        // locus exactly, once a click has paid for it.
        //
        // Naming the wrong panel describes a click that then rewrites the
        // other one's regions, and `navToLocString` REPLACES them.
        clickLine(hover.side, hover.canScroll),
      ]}
    />
  )
})

export default OffscreenMateTooltip

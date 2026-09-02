import { visibleSpanOnRefName } from '../LaunchSyntenyView/visibleSpanOnRefName.ts'

import type { SpanOfInterest } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FeatPos } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/** One offered "move a panel" item, with everything the move itself needs. */
export interface BandMoveTarget {
  label: string
  toMate: boolean
  movingView: LinearGenomeViewModel
  // Where the panel that STAYS sits in the stack, which is what the move points
  // the follow at. Named here rather than re-derived from `toMate` and the
  // level: the two items differ in exactly this, and a second spelling of
  // "which one stays" is how the item and the action come to disagree about it —
  // the same reason `window` is read here.
  stayingIndex: number
  // The staying panel's visible window on this alignment's axis — read HERE, at
  // the moment of the right-click, rather than again inside the move. It is
  // both what decides the item is offerable and what the move maps across, so
  // there is one reading of it and the item cannot promise a window the action
  // then fails to find.
  window: SpanOfInterest
}

/**
 * The move items a right-clicked band offers.
 *
 * TWO ITEMS RATHER THAN ONE, because a band is drawn BETWEEN two panels and
 * "the other panel" has no answer from a click on the band itself — unlike the
 * same item on the LGV track menu, where the panel that was right-clicked is
 * the one that stays. Naming the rows top/bottom is the only phrasing that
 * stays true wherever in a taller stack this band sits.
 *
 * ONLY WHERE THERE IS AN ALIGNMENT STRING TO WALK. Without one the mate
 * position can only be interpolated across the block, and a menu item that
 * navigates a panel to a straight-line guess and shows it flush against its
 * neighbour is presenting a guess as a correspondence. The coarse tier's
 * `cr:Z:` fold counts: its runs keep a walk within the fold's `--coarse` gap,
 * sub-pixel at the zoom the tier is served (ADR-103). What stays absent is a
 * CIGAR-less PAF, and a coarse tier built before the fold existed.
 *
 * AND ONLY WHERE THE STAYING PANEL IS ACTUALLY SHOWING THIS ALIGNMENT'S CONTIG.
 * That is not implied by the band being on screen: a ribbon is drawn out to the
 * overdraw band, which at whole-genome zoom is many contigs wide, so a panel can
 * be scrolled to a different contig with the ribbon still painted. There is then
 * no window to map across, and the move used to return silently — a menu item
 * that did nothing, in the one situation the item exists for, which is panels
 * that have drifted apart. Offered or absent, never inert.
 */
export function bandMoveTargets({
  level,
  topView,
  bottomView,
  feat,
  hasCigar,
}: {
  // the band's own level, so the two items can name the panel that stays by its
  // position in the stack: this band sits between `views[level]` and
  // `views[level + 1]`
  level: number
  topView: LinearGenomeViewModel | undefined
  bottomView: LinearGenomeViewModel | undefined
  feat: FeatPos
  hasCigar: boolean
}): BandMoveTarget[] {
  if (!topView || !bottomView || !hasCigar) {
    return []
  }
  // Top first, matching the rows on screen and the order the user guide names
  // them in. `toMate` says which axis the STAYING panel is read off: the query
  // axis when the mate panel is the one moving, the mate axis when it is not.
  return [
    {
      label: 'Move top panel to the matching region',
      toMate: false,
      stayingView: bottomView,
      stayingIndex: level + 1,
      movingView: topView,
      refName: feat.mate.refName,
    },
    {
      label: 'Move bottom panel to the matching region',
      toMate: true,
      stayingView: topView,
      stayingIndex: level,
      movingView: bottomView,
      refName: feat.refName,
    },
  ].flatMap(({ stayingView, refName, ...rest }) => {
    const window = visibleSpanOnRefName(stayingView, refName)
    return window ? [{ ...rest, window }] : []
  })
}

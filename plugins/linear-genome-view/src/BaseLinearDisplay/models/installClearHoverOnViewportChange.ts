import { getContainingView } from '@jbrowse/core/util'
import { reaction } from 'mobx'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { IReactionDisposer } from 'mobx'

interface HoverHost extends IStateTreeNode {
  // `TrackHeightMixin`'s, and not every display composes it — a display with
  // no internal scroll simply has no third axis to move on
  scrollTop?: number
  regionTooLarge: boolean
  clearHoveredFeature: () => void
}

/**
 * Drop a display's hover whenever the content it names goes away under a
 * stationary cursor. A sticky canvas has no element travelling with its
 * features, so the browser fires no `mousemove` and no `mouseleave`.
 *
 * **Four axes, not one.** Three move the content — zoom, `offsetPx` (a
 * side-scroll or locstring pan fires no pointer event at all), and the display's
 * own `scrollTop`. The fourth removes it: `regionTooLarge` replaces the whole
 * subtree with the banner, and Force load brings it back, where a highlight box
 * positioned from the layout draws with no pointer anywhere near it. The
 * reaction fires on both directions of the flip, so the release is covered too.
 *
 * A `reaction`, not an `autorun`, and that is load-bearing: the effect reads
 * hover state to skip a no-op clear, and as an autorun that read would be a
 * dependency — setting a hover would re-fire the body and clear it again.
 *
 * A display that never opts the gate in reads `regionTooLarge` as a literal
 * `false`, so the fourth term costs it nothing.
 *
 * **There is a fifth way the content moves, deliberately not watched:** a track
 * above this one changing height slides this display's whole box down the page
 * under a stationary cursor — an alignments display fitting its pileup as reads
 * arrive, a track shown or hidden, someone dragging a resize handle.
 *
 * `view.trackHeights` is the tempting term, and it over-clears: that sum also
 * moves when a track BELOW the hovered one grows, which moves nothing the cursor
 * is over, and it moves once per frame while a grow-to-fit display settles. So
 * hovering a gene on track 1 while an alignments track further down fills in
 * would blink the tooltip out several times a second — trading a staleness that
 * fixes itself on the next mouse move for a flicker during exactly the moments a
 * user is watching data land. The precise term is the sum of the heights ABOVE
 * this display, which each display can compute from its index in `view.tracks`,
 * but that makes every display's hover reaction depend on every earlier track's
 * height — a far wider dependency graph than the four axes it would join, and
 * O(tracks²) for a reflow that moves everything.
 *
 * A `ResizeObserver` on the display's own box sidesteps the choice by measuring
 * the thing that actually matters, at the cost of putting DOM into a gate that
 * is currently pure model state. Weigh that against how little goes wrong: the
 * staleness self-heals on the very next `mousemove`, the highlight box travels
 * with the canvas so nothing on screen looks wrong, only the tooltip's text is
 * stale, and nobody has reported it. The dotplot's version of this bug was worse
 * (its tooltip is anchored to the pointer while the restroke is anchored to the
 * plot, so the two visibly separate) and its fix was free, because `viewHeight`
 * was already an input to the projection everything else read. Neither holds
 * here. Read all of that before adding the term.
 *
 * **The fetch foundations install this, so a display does not.** It clears
 * through `BaseDisplay.clearHoveredFeature`, whose default is a no-op, so a
 * display that derives its hover pays one string interpolation per viewport
 * change and one empty call. That is cheaper than the alternative it replaces:
 * six displays each passing their own one-line closure, and any seventh being
 * free to forget.
 */
export function installClearHoverOnViewportChange(
  self: HoverHost,
): IReactionDisposer {
  return reaction(
    () => {
      const view = getContainingView(self) as LinearGenomeViewModel
      return `${view.bpPerPx}-${view.offsetPx}-${self.scrollTop ?? 0}-${self.regionTooLarge}`
    },
    () => {
      self.clearHoveredFeature()
    },
    { name: 'ClearHoverOnViewportChange' },
  )
}

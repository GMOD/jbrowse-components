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
 * under a stationary cursor. `view.trackHeights` would catch it and over-clear —
 * see `agent-docs/ideas/hover-clear-on-track-reflow.md` for why that trade went
 * the other way, and read it before adding the term.
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

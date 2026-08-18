import { addDisposer } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The host, duck-typed rather than imported: the level's own model type is
 * built by the factory this installs from, so naming it here is a cycle.
 */
interface BandHoverHost extends IStateTreeNode {
  /** The viewport numbers a ribbon is drawn through — see the getter. */
  bandTransformKey: string
  /** The level's fan-out action; `undefined` clears every display under it. */
  setHoveredFeature: (hit: undefined) => void
}

/**
 * Drop the level's hover whenever the band moves under a stationary cursor.
 *
 * A stored hover is only as good as its invalidation, and the pointer handlers
 * answer one axis of it: the pointer moving. The other axis is the content
 * moving instead, which fires no pointer event at all — `LevelSyntenyCanvas`
 * sets the hover from `mousemove` and clears it from `mouseleave`, and neither
 * runs when a wheel over that same canvas scroll-zooms both rows underneath it
 * (`useWheelScrollZoom` suppresses the hover handler for the duration and
 * nothing re-picks after it settles). The hover then goes on naming the ribbon
 * the cursor *used* to be over, which is what `tooltipLines` renders and what
 * `renderParams.hoveredFeatureId` outlines.
 *
 * Nothing else covers it. `setRpcData` clears the stored index, but only a
 * fetch calls that, and `currentFetchKey` is built from a snapped fetch window
 * and a log2 zoom bucket — so a pan inside the buffer or a zoom inside the
 * bucket commits nothing and the hover survives.
 *
 * On the level rather than the display, because the level is what owns the
 * hover: `setHoveredFeature` already fans one pick hit out across every display
 * in the band, so one reaction here is one answer for all of them.
 *
 * A `reaction` and not an `autorun` for the reason dotplot's twin
 * (`setupClearHoverOnPlotMove`) is one: the effect writes the hover, and an
 * autorun body that both read and wrote it would re-fire itself.
 *
 * The LGV family answers the same question through
 * `installClearHoverOnViewportChange`, which its fetch foundation installs;
 * the comparative family has no such foundation, so each view installs its own.
 */
export function installClearHoverOnBandMove(self: BandHoverHost) {
  addDisposer(
    self,
    reaction(
      () => self.bandTransformKey,
      () => {
        self.setHoveredFeature(undefined)
      },
      { name: 'SyntenyClearHoverOnBandMove' },
    ),
  )
}

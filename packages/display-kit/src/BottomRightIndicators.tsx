import { use } from 'react'

import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'
import {
  BOTTOM_RIGHT_CONTROLS_ORDER,
  BottomRightCornerContext,
  TrackOverlayPortal,
} from '@jbrowse/display-ui'
import { observer } from 'mobx-react'
import { createPortal } from 'react-dom'

import type { ReactNode } from 'react'

// The one row for every bottom-right control a display draws for itself (track
// sizing, overflow expand/restore, the isoform-collapse notice), so they lay
// out together. Children gate themselves and an all-null flex container has no
// size, so callers render every indicator unconditionally.
//
// The row is a member of the corner the chrome anchors (bottomRightCorner.ts),
// which it shares with the chrome's background-progress chip.
//
// Two contracts a display that re-rolled the row would drop:
//
// - It is portalled above the inter-region padding masks, which would
//   otherwise stripe across the chips in collapsed-intron and multi-region
//   views (ADR-058).
// - It claims the press. An embedder whose own pan handler captures the
//   pointer on pointerdown would retarget the click that opens these menus;
//   `data-gesture-owner` is the marker for it.
//
// The z-index matters only un-portalled (a display an embedder mounts
// standalone), where the row has to win against `VerticalScrollbar` at 10.
const OVERFLOW_INDICATOR_Z_INDEX = 999

const BottomRightIndicators = observer(function BottomRightIndicators({
  scrollableHeight = 0,
  children,
}: {
  /**
   * The display's `VirtualScrollModel.scrollableHeight`: while it is positive
   * the `VerticalScrollbar` shows, and the row clears it.
   *
   * It shifts this row alone rather than the whole corner, and that is right in
   * both directions: the row is the rightmost member, so the status chip stacked
   * above it clears the scrollbar transitively, and a display showing only the
   * chip is where the chip was before.
   */
  scrollableHeight?: number
  children: ReactNode
}) {
  const clearance = scrollableHeight > 0 ? VERTICAL_SCROLLBAR_CLEARANCE : 0
  // Null outside a chrome (standalone mount, unit test, SVG export), where the
  // row claims the corner itself.
  const cornerEl = use(BottomRightCornerContext)
  const row = (
    <div
      style={
        cornerEl
          ? {
              // An in-flow member of the corner's column. A flex item honours
              // `z-index` with no `position` of its own (Flexbox §5.4).
              order: BOTTOM_RIGHT_CONTROLS_ORDER,
              zIndex: OVERFLOW_INDICATOR_Z_INDEX,
              marginRight: clearance,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              pointerEvents: 'auto',
            }
          : {
              position: 'absolute',
              bottom: 2,
              right: clearance + 2,
              zIndex: OVERFLOW_INDICATOR_Z_INDEX,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              pointerEvents: 'auto',
            }
      }
      data-gesture-owner="true"
      onPointerDown={event => {
        event.stopPropagation()
      }}
    >
      {children}
    </div>
  )
  return cornerEl ? (
    createPortal(row, cornerEl)
  ) : (
    <TrackOverlayPortal>{row}</TrackOverlayPortal>
  )
})

export default BottomRightIndicators

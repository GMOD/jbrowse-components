import { use } from 'react'

import {
  BOTTOM_RIGHT_CONTROLS_ORDER,
  BottomRightCornerContext,
  TrackOverlayPortal,
} from '@jbrowse/display-ui'
import { createPortal } from 'react-dom'

import type { ReactNode } from 'react'

// Single anchor point for every bottom-right overlay a display draws for itself
// (track sizing, overflow expand/restore, isoform-collapse notice, ...) so they
// lay out as one row instead of each picking their own position and colliding.
// Children are self-gating (each renders null when inactive); an all-null flex
// container has no size, so there's no need to also track "is anything visible"
// here — callers just render every indicator unconditionally.
//
// The corner is shared with one thing this row cannot see: the chrome's
// background-progress chip, which is rendered by the overlay set rather than by
// the display. Both used to pin themselves to the same coordinates of the same
// overlay layer, so the chrome anchors the corner now and this row is a member
// of it (`bottomRightCorner.ts`) rather than a second box over it. Which is what
// the paragraph above always claimed and, for that one chip, was not.
//
// Lives here rather than in one display's plugin because the two things it does
// beyond layout are both contracts, and a display that re-rolled the row would
// silently opt out of them:
//
// - **Portaled above the inter-region padding masks.** A display's tree is
//   sealed in a `contain:strict` stacking context that the masks paint over, so
//   in collapsed-introns / multi-region views the region separators would stripe
//   straight across these chips no matter what z-index they carry.
// - **Claims the press.** An embedder that pans the view with its own pointer
//   handler sits above this row; if it captures the pointer on pointerdown, the
//   click that opens these menus is retargeted at the embedder's element and
//   never arrives. JBrowse's own pan skips `button` targets, so the marker is
//   for everyone else's — see the build-your-own examples site, whose pan
//   handler is exactly that shape.
//
// The z-index matters only in the un-portaled fallback (no TrackContainer, i.e.
// a display mounted standalone by an embedder). There this row is an ordinary
// sibling of the display body, and it has to win against overlays inside it —
// `VerticalScrollbar` sits at 10.
const OVERFLOW_INDICATOR_Z_INDEX = 999

function BottomRightIndicators({
  scrollbarWidth = 0,
  children,
}: {
  /**
   * How much of the display's right edge its own scrollbar occupies *right
   * now* — 0 when nothing is overflowing. Keeps the indicators from rendering
   * underneath it. Displays that scroll with a native overflow container pass
   * that container's scrollbar width; displays drawing `VerticalScrollbar` pass
   * its track width.
   *
   * It shifts this row alone rather than the whole corner, and that is right in
   * both directions: the row is the rightmost member, so the status chip stacked
   * above it clears the scrollbar transitively, and a display showing only the
   * chip is where the chip was before.
   */
  scrollbarWidth?: number
  children: ReactNode
}) {
  // The chrome anchors the corner and puts its background-progress chip in it,
  // so landing in that box is what keeps the two from being drawn on top of
  // each other — see bottomRightCorner.ts. Null outside a chrome (a display an
  // embedder mounted standalone, a unit test, the SVG export): claim the corner
  // as this always did, there being nothing else in it to collide with.
  const cornerEl = use(BottomRightCornerContext)
  const row = (
    <div
      style={
        cornerEl
          ? {
              // an in-flow member of the corner's column, which owns the
              // position. The z-index is still ours and still means what it
              // always did — the corner sets none, so this competes in the
              // overlay layer directly, and a flex item honours `z-index` with
              // no `position` of its own (Flexbox §5.4).
              order: BOTTOM_RIGHT_CONTROLS_ORDER,
              zIndex: OVERFLOW_INDICATOR_Z_INDEX,
              marginRight: scrollbarWidth,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              pointerEvents: 'auto',
            }
          : {
              position: 'absolute',
              bottom: 2,
              right: scrollbarWidth + 2,
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
}

export default BottomRightIndicators

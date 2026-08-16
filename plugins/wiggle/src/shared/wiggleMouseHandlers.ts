import { eventPoint } from '@jbrowse/core/util/eventPoint'

import type { MouseState } from '@jbrowse/core/ui'

interface MouseTrackingModel<T> {
  setHoveredFeature: (feat?: T) => void
  selectFeature: (feat: T) => void
}

// Hover/select wiring for the wiggle-family display components, over the pointer
// measurement `DisplayChrome` now owns — so the hit, the tooltip and the cursor
// guides all come off one container rect in one frame. Single- and multi-wiggle
// differ only in how a hit is resolved (one source vs row/overlay), so that
// stays a callback.
//
// It no longer measures anything itself: the chrome binds the handlers, because
// it owns the element they measure against. What is left is the pair a wiggle
// display feeds it — `onPointerPosition` for the hover, `onClick` for the select.
export function wiggleMouseHandlers<T>(
  model: MouseTrackingModel<T>,
  computeHit: (offsetX: number, offsetY: number) => T | undefined,
) {
  return {
    onPointerPosition: (state?: MouseState) => {
      model.setHoveredFeature(state ? computeHit(state.x, state.y) : undefined)
    },
    // Resolved from the click itself rather than from the hover a previous frame
    // recorded, which can be stale — the viewport moves under a stationary
    // cursor. `currentTarget` is the chrome container, the same box the tracker
    // measures against.
    onClick: (event: React.MouseEvent) => {
      const { x, y } = eventPoint(event)
      const feat = computeHit(x, y)
      if (feat) {
        model.selectFeature(feat)
      }
    },
  }
}

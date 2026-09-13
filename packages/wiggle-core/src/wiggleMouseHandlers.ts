import { eventPoint } from '@jbrowse/core/util/eventPoint'

import type { MouseState } from '@jbrowse/core/ui'

interface MouseTrackingModel<T> {
  setHoveredFeature: (feat?: T) => void
  selectFeature: (feat: T) => void
}

/**
 * The hover and select handlers a display hands `DisplayChrome`, over its own
 * hit function. The click resolves its hit from the click itself rather than
 * from the last hover, which is stale once the viewport moves under a
 * stationary cursor.
 */
export function wiggleMouseHandlers<T>(
  model: MouseTrackingModel<T>,
  computeHit: (offsetX: number, offsetY: number) => T | undefined,
) {
  return {
    onPointerPosition: (state?: MouseState) => {
      model.setHoveredFeature(state ? computeHit(state.x, state.y) : undefined)
    },
    onClick: (event: React.MouseEvent) => {
      const { x, y } = eventPoint(event)
      const feat = computeHit(x, y)
      if (feat) {
        model.selectFeature(feat)
      }
    },
  }
}

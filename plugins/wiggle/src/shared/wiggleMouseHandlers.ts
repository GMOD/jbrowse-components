import { eventPoint } from '@jbrowse/core/util/eventPoint'

import type { MouseState } from '@jbrowse/core/ui'

interface MouseTrackingModel<T> {
  setHoveredFeature: (feat?: T) => void
  selectFeature: (feat: T) => void
}

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

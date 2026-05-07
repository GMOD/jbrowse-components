import { types } from '@jbrowse/mobx-state-tree'

/**
 * Records the viewport state (`offsetPx`, `bpPerPx`) at which the canvas
 * was last fully drawn. Consumers use `viewportTransform(view)` to compute
 * the CSS transform that keeps the stale canvas aligned with the live
 * viewport while a fresh fetch is in flight — pan-during-fetch slides the
 * old pixels rather than blanking, zoom-during-fetch scales them.
 *
 * Composed by displays that hold a single global RPC result (HiC, LD)
 * rather than per-region buffers, since per-region displays handle this
 * via the GPU shader's per-region uniforms.
 */
export default function StaleViewportRescaleMixin() {
  return types
    .model('StaleViewportRescaleMixin', {})
    .volatile(() => ({
      lastDrawnOffsetPx: undefined as number | undefined,
      lastDrawnBpPerPx: undefined as number | undefined,
    }))
    .actions(self => ({
      setLastDrawnViewport(offsetPx: number, bpPerPx: number) {
        self.lastDrawnOffsetPx = offsetPx
        self.lastDrawnBpPerPx = bpPerPx
      },
    }))
    .views(self => ({
      viewportTransform(view: { bpPerPx: number; offsetPx: number }) {
        if (
          self.lastDrawnBpPerPx === undefined ||
          self.lastDrawnOffsetPx === undefined
        ) {
          return { scale: 1, translateX: 0 }
        }
        const scale = self.lastDrawnBpPerPx / view.bpPerPx
        return {
          scale,
          translateX: self.lastDrawnOffsetPx * scale - view.offsetPx,
        }
      },
    }))
}

export type StaleViewportRescaleMixinType = ReturnType<
  typeof StaleViewportRescaleMixin
>

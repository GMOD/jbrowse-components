import { types } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel StaleViewportRescaleMixin
 * #category display
 *
 * Records the viewport state (`offsetPx`, `bpPerPx`) at which the canvas
 * was last fully drawn. Consumers (HiC, LD — single-global-RPC-result
 * displays) build a `renderTransform` getter on top of these fields to
 * keep stale pixels aligned with the live viewport during pan-during-fetch
 * and zoom-during-fetch.
 *
 * The transform's formula is display-specific because it depends on what
 * data-x = 0 represents in the worker output — see `plugins/hic` and
 * `plugins/variants/LDDisplay` for the canonical
 *   `viewOffsetX = max(0, lastDrawnOffsetPx) * scale - view.offsetPx`
 * pattern (handles negative offsetPx when scrolled left of genome start).
 */
export default function StaleViewportRescaleMixin() {
  return types
    .model('StaleViewportRescaleMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * offsetPx of the viewport when the canvas was last fully drawn
       */
      lastDrawnOffsetPx: undefined as number | undefined,
      /**
       * #volatile
       * bpPerPx of the viewport when the canvas was last fully drawn
       */
      lastDrawnBpPerPx: undefined as number | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLastDrawnViewport(offsetPx: number, bpPerPx: number) {
        self.lastDrawnOffsetPx = offsetPx
        self.lastDrawnBpPerPx = bpPerPx
      },
    }))
}

export type StaleViewportRescaleMixinType = ReturnType<
  typeof StaleViewportRescaleMixin
>

import { types } from '@jbrowse/mobx-state-tree'
import { computed } from 'mobx'

/** The pointer in the chrome container's px, as `onPointerPosition` hands it. */
export interface PointerPx {
  x: number
  y: number
}

/**
 * #stateModel PointerHoverMixin
 * #crossCuttingMixin A hover derived from the pointer. The hit type, as the type parameter. Brings the `pointer` volatile, `setPointer` for the chrome's `onPointerPosition`, the `hoverHitAt` hook a display overrides, and the `hoveredFeature` getter `BaseDisplay` declares as a hook
 * #category display
 *
 * The other way to answer `hoveredFeature` beside `StoredHoverMixin`: the
 * display stores where the pointer is, never what is under it, and the hover
 * is `hoverHitAt(pointer)`. A pan, a zoom, a scroll or a fetch landing under a
 * stationary cursor re-resolves the hit, so nothing has to clear it on the
 * viewport's axes and `clearHoveredFeature` stays `BaseDisplay`'s no-op. The
 * pointer goes away through the chrome, which reports `undefined` when it
 * leaves, a banner replaces the container, or a context menu opens or closes.
 *
 * `sameHit` names the fields that make two hits one hover: a hit test hands
 * back a fresh object per call, and without it every pointer move would
 * invalidate the highlight and every other reader of `hoveredFeature`.
 *
 * Compose it after `BaseDisplay` so the typed getter wins, and override
 * `hoverHitAt` in the display's own views.
 */
export default function PointerHoverMixin<T>(
  sameHit: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  return types
    .model('PointerHoverMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * where the pointer is over the display, or undefined while it is not
       */
      pointer: undefined as PointerPx | undefined,
    }))
    .views(() => ({
      /**
       * #method
       * Overridable hook (default nothing): what hovering at this
       * container-px point names. A display that answers no hover while its
       * data reloads says so here.
       */
      hoverHitAt(_x: number, _y: number): T | undefined {
        return undefined
      },
    }))
    .views(self => {
      const hovered = computed(
        () => {
          const { pointer } = self
          return pointer ? self.hoverHitAt(pointer.x, pointer.y) : undefined
        },
        {
          equals: (a, b) =>
            a === b || (a !== undefined && b !== undefined && sameHit(a, b)),
        },
      )
      return {
        /**
         * #getter
         * what is under the pointer, re-resolved whenever the content under
         * it moves
         */
        get hoveredFeature(): T | undefined {
          return hovered.get()
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * the chrome's `onPointerPosition`
       */
      setPointer(state?: PointerPx) {
        const cur = self.pointer
        if (state?.x !== cur?.x || state?.y !== cur?.y) {
          self.pointer = state && { x: state.x, y: state.y }
        }
      },
    }))
}

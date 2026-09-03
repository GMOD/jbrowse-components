import { types } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel StoredHoverMixin
 * #crossCuttingMixin A stored hover. The hit type, as the type parameter. Brings the `hoveredFeature` getter `BaseDisplay` declares as a hook, `setHoveredFeature`, and the `clearHoveredFeature` the foundations' viewport-change reaction calls
 * #category display
 *
 * For a display whose hover is a hit it stores from the pointer handler rather
 * than one it derives from an id index: the volatile, the getter that fills
 * `BaseDisplay`'s `hoveredFeature` hook (declared there as a computed, so a
 * volatile cannot take the name directly), the setter, and the clear. Compose
 * it after `BaseDisplay` so the typed getter wins.
 *
 * `sameHit` is the identity a display's pointer handler resolves fresh on every
 * move: a display whose hit is a new object per frame names the fields that
 * make two of them one hover, so a mouse moving inside one block writes
 * nothing and invalidates no observer.
 */
export default function StoredHoverMixin<T>(
  sameHit: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  return types
    .model('StoredHoverMixin', {})
    .volatile(() => ({
      storedHoveredFeature: undefined as T | undefined,
    }))
    .views(self => ({
      get hoveredFeature(): T | undefined {
        return self.storedHoveredFeature
      },
    }))
    .actions(self => ({
      setHoveredFeature(hit?: T) {
        const cur = self.storedHoveredFeature
        if (hit === undefined || cur === undefined || !sameHit(hit, cur)) {
          self.storedHoveredFeature = hit
        }
      },
      clearHoveredFeature() {
        self.storedHoveredFeature = undefined
      },
    }))
}

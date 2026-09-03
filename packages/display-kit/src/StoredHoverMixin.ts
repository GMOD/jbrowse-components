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
 */
export default function StoredHoverMixin<T>() {
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
        self.storedHoveredFeature = hit
      },
      clearHoveredFeature() {
        self.storedHoveredFeature = undefined
      },
    }))
}

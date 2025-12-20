import { types } from '@jbrowse/mobx-state-tree'

import type { ChainData, ColorBy, FilterBy } from './types'

/**
 * Base mixin for all LinearRead displays (Cloud, Stack, Arcs)
 * Contains common volatile state, views, and actions shared across all three display types
 */
export function LinearReadDisplayBaseMixin() {
  return types
    .model('LinearReadDisplayBaseMixin', {
      /**
       * #property
       * Filter settings override (if set, overrides configuration)
       */
      filterBySetting: types.frozen<FilterBy | undefined>(),

      /**
       * #property
       * Color scheme settings override (if set, overrides configuration)
       */
      colorBySetting: types.frozen<ColorBy | undefined>(),
    })
    .volatile(() => ({
      /**
       * #volatile
       * Loading state for data fetching
       */
      loading: false,
      /**
       * #volatile
       * Chain data containing features to render
       */
      chainData: undefined as ChainData | undefined,
      /**
       * #volatile
       * Last drawn offset pixel position (for tracking view changes)
       */
      lastDrawnOffsetPx: undefined as number | undefined,
      /**
       * #volatile
       * Last drawn base pairs per pixel (for tracking zoom changes)
       */
      lastDrawnBpPerPx: 0,
      /**
       * #volatile
       * Reference to the main canvas element
       */
      ref: null as HTMLCanvasElement | null,
    }))
    .actions(self => ({
      /**
       * #action
       * Update the last drawn offset pixel position
       */
      setLastDrawnOffsetPx(n: number) {
        self.lastDrawnOffsetPx = n
      },
      /**
       * #action
       * Update the last drawn bp per pixel value
       */
      setLastDrawnBpPerPx(n: number) {
        self.lastDrawnBpPerPx = n
      },
      /**
       * #action
       * Set loading state
       */
      setLoading(f: boolean) {
        self.loading = f
      },
      /**
       * #action
       * Set reference to the canvas element
       * Internal, used by the autorun to draw the canvas
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
      },
      /**
       * #action
       * Set the color scheme override
       */
      setColorScheme(colorBy: { type: string }) {
        self.colorBySetting = {
          ...colorBy,
        }
      },
      /**
       * #action
       * Set the chain data to render
       */
      setChainData(args: ChainData) {
        self.chainData = args
      },
      /**
       * #action
       * Set the filter override
       */
      setFilterBy(filter: FilterBy) {
        self.filterBySetting = {
          ...filter,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Check if the display has been drawn at least once
       */
      get drawn() {
        return self.lastDrawnOffsetPx !== undefined
      },
    }))
}

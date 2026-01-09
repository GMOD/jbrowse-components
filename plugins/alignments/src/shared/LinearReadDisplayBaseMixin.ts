import { types } from '@jbrowse/mobx-state-tree'
import { NonBlockCanvasDisplayMixin } from '@jbrowse/plugin-linear-genome-view'

import type { ChainData, ColorBy, FilterBy } from './types.ts'

/**
 * #stateModel LinearReadDisplayBaseMixin
 * Base mixin for all LinearRead displays (Cloud, Stack, Arcs)
 * Contains common volatile state, views, and actions shared across all three
 * display types. Composes with NonBlockCanvasDisplayMixin for the shared
 * non-block canvas display state.
 *
 * extends
 * - [NonBlockCanvasDisplayMixin](../nonblockcanvasdisplaymixin)
 */
export function LinearReadDisplayBaseMixin() {
  return types.compose(
    'LinearReadDisplayBaseMixin',
    NonBlockCanvasDisplayMixin(),
    types
      .model({
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
         * Chain data containing features to render
         */
        chainData: undefined as ChainData | undefined,
        /**
         * #volatile
         * Last drawn base pairs per pixel (for tracking zoom changes)
         */
        lastDrawnBpPerPx: 0,
      }))
      .actions(self => ({
        /**
         * #action
         * Update the last drawn bp per pixel value
         */
        setLastDrawnBpPerPx(n: number) {
          self.lastDrawnBpPerPx = n
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
      })),
  )
}

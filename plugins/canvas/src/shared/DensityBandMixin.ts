import DensityTierMixin from '@jbrowse/display-kit/DensityTierMixin'
import { densityBandPending } from '@jbrowse/display-kit/densityBandPhase'
import { types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'

import {
  densityBandReadout,
  densityHoverAt,
  displayDensityBandLayer,
} from './densityBandViews.ts'

import type { DensityBandHost, DensityHover } from './densityBandViews.ts'

function bandHost(self: object) {
  return self as DensityBandHost
}

/**
 * The density band: where the cursor is over it, what it draws and what it
 * reads out. Composing `DensityTierMixin` rather than sitting beside it forces
 * the order, since every getter here keys off the swap the tier decides.
 *
 * #stateModel DensityBandMixin
 * #category display
 */
export default function DensityBandMixin() {
  return types.compose(
    'DensityBandMixin',
    DensityTierMixin(),
    types
      .model({})
      .volatile(() => ({
        /**
         * #volatile
         * The cursor's view px, not the bp under it: a wheel zoom under a
         * stationary cursor fires no mousemove, and the px stays true through
         * it.
         */
        densityHoverPx: undefined as number | undefined,
      }))
      .views(self => ({
        /**
         * #getter
         */
        get densityBandActive() {
          return (
            bandHost(self).densityTierActive && bandHost(self).host.initialized
          )
        },
        /**
         * #getter
         */
        get densityBandLayer() {
          return displayDensityBandLayer(bandHost(self))
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get densityHover(): DensityHover | undefined {
          return self.densityBandActive
            ? densityHoverAt(containingLgv(self), self.densityHoverPx)
            : undefined
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Kept only while the band is up, so a pointer over features writes
         * nothing here.
         */
        setDensityHoverPx(px?: number) {
          self.densityHoverPx = self.densityBandActive ? px : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The band's line of text with no cursor over it, which is what the SVG
         * export writes.
         */
        get densityPeakReadout() {
          return densityBandReadout(self.densityBandLayer, undefined)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Blank until the first read lands, so the scrim is not captioned "no
         * density data" for a read still in flight.
         */
        get densityReadout() {
          return densityBandPending(bandHost(self))
            ? ''
            : self.densityHover
              ? densityBandReadout(self.densityBandLayer, self.densityHover)
              : self.densityPeakReadout
        },
      })),
  )
}

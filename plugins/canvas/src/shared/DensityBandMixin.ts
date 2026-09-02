import { getContainingView } from '@jbrowse/core/util'
import DensityTierMixin from '@jbrowse/display-kit/DensityTierMixin'
import { types } from '@jbrowse/mobx-state-tree'

import {
  densityBandDisplayPhase,
  densityBandReadout,
  densityBandSvgReady,
  densityHoverAt,
  displayDensityBandLayer,
} from './densityBandViews.ts'

import type { DensityBandHost, DensityHover } from './densityBandViews.ts'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * The view as the band's pointer readout sees it, and nothing more.
 *
 * Named structurally rather than as `LinearGenomeViewModel`, which both copies
 * of this block cast to: `densityBandViews` duck-types its host all the way
 * down so the band sits below the view plugin, and a mixin casting to the
 * whole view model would put the import back.
 */
interface DensityBandPointerView {
  initialized: boolean
  pxToBp: (px: number) => { index: number; coord0: number; oob: boolean }
}

function bandView(self: object) {
  return getContainingView(self) as unknown as DensityBandPointerView
}

function bandHost(self: object) {
  return self as DensityBandHost
}

/**
 * The density band: where the cursor is over it, what it draws, what it reads
 * out, and the three foundation getters the band stands in for the too-large
 * banner in.
 *
 * Composes `DensityTierMixin` rather than sitting beside it, because the swap
 * it decides is what every getter here keys off — a display taking the band
 * takes the tier, in that order, and cannot compose them the wrong way round.
 * A display with its own stand-in for the banner takes the tier alone, which is
 * what `LinearAlignmentsDisplay` does.
 *
 * Composed after the fetch foundation, whose `displayPhase` / `svgReady` it
 * post-processes — `types.compose` resolves a collision to the later argument.
 *
 * The two displays drawing a band compose it: `LinearBasicDisplay`'s base model
 * and `LinearMultiRowFeatureDisplay`, which had the block written out line for
 * line.
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
         * Where the cursor is over the density band, for its readout.
         */
        densityHover: undefined as DensityHover | undefined,
      }))
      .actions(self => ({
        /**
         * #action
         * The cursor's view px over the band, or nothing when it leaves.
         */
        setDensityHoverPx(px?: number) {
          self.densityHover = densityHoverAt(bandView(self), px)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether the band stands in for the features here — the tier's own
         * decision, plus the view geometry the draw is mapped through.
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
         * The band's line of text: its peak, and the source's value under the
         * cursor while there is one.
         */
        get densityReadout() {
          return densityBandReadout(
            self.densityBandLayer,
            bandHost(self).densityBins,
            self.densityHover,
          )
        },
        /**
         * #getter
         * The foundation's phase with the too-large banner swapped for the band —
         * see `densityBandDisplayPhase`.
         */
        get displayPhase(): DisplayPhase {
          return densityBandDisplayPhase(bandHost(self))
        },
        /**
         * #getter
         * The export gate with the same swap — see `densityBandSvgReady`.
         */
        get svgReady(): boolean {
          return densityBandSvgReady(bandHost(self))
        },
        /**
         * #getter
         * `renderDisplaySvg`'s hook: the export paints the band in place of the
         * too-large note, the same swap the chrome makes on screen.
         */
        get drawsWhenTooLarge() {
          return self.densityBandActive
        },
      })),
  )
}

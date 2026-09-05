import { snapFittedContentHeight } from './fitLadder.ts'
import { countTruncatedFeatures, maxBottom } from './layoutQueries.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitStage } from './fitLadder.ts'

const MIN_GROW_HEIGHT = 50

export interface HeightHost {
  height: number
  layoutReady: boolean
  fitHeightToDisplay: boolean
  fitTargetHeight: number
  fitStage: FitStage
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  onScreenFeatureIds: ReadonlySet<string> | undefined
  fitMeasureFeatureIds: ReadonlySet<string> | undefined
  morphFromTops: Map<string, number> | undefined
  morphFromMaxY: number
}

export function heightViews(self: HeightHost) {
  return {
    /**
     * #getter
     */
    // Grow mode sizes the track from this, so it leaves out the morph hold or
    // the track bounces for the morph's duration. Fit mode reads
    // `fitTargetHeight`, the config slot, rather than the reactive `height`,
    // so grow's height chain cannot cycle.
    get settledMaxY() {
      if (!self.fitHeightToDisplay) {
        return maxBottom(self.fitStage.layout)
      }
      const { contentHeight: keptRungHeight, scale } = self.fitStage
      return snapFittedContentHeight(
        keptRungHeight * scale,
        self.fitTargetHeight,
        scale !== 1,
      )
    },

    /**
     * #getter
     */
    get maxY() {
      // Held at the taller of the old and new layout for the morph, so a
      // feature easing up from a deeper row is not clipped.
      return self.morphFromTops === undefined
        ? this.settledMaxY
        : Math.max(this.settledMaxY, self.morphFromMaxY)
    },

    /**
     * #getter
     */
    // Measured over the on-screen rows, not the buffered pack: a scrollbar
    // over rows nothing in view occupies tells the reader features are hidden
    // below a track showing all of them. `settledMaxY` rather than the morph-
    // aware `maxY`, because `morphFromMaxY` spans the whole buffered pack.
    get scrollExtentMaxY() {
      const ids = self.fitHeightToDisplay ? undefined : self.onScreenFeatureIds
      return ids ? maxBottom(self.laidOutDataMap, ids) : this.settledMaxY
    },

    /**
     * #getter
     */
    get hasOverflow() {
      return this.scrollExtentMaxY > self.height
    },

    /**
     * #getter
     */
    // Features past GranularRectLayout's row limit are absent, not scrolled
    // out of view, so nothing else counts them.
    get truncatedFeatureCount() {
      return countTruncatedFeatures(
        self.laidOutDataMap,
        self.fitMeasureFeatureIds,
      )
    },

    /**
     * #getter
     */
    get contentHeight() {
      return Math.max(this.maxY, self.height)
    },

    /**
     * #getter
     */
    get scrollContentHeight() {
      return Math.max(this.scrollExtentMaxY, self.height)
    },

    /**
     * #getter
     */
    get scrollableHeight() {
      return Math.max(0, this.scrollExtentMaxY - self.height)
    },

    /**
     * #getter
     */
    // Before a layout the content height is unknown rather than zero, so the
    // track holds its slot height instead of squeezing the too-large banner
    // to the floor.
    get growTargetHeight() {
      return self.layoutReady
        ? Math.max(MIN_GROW_HEIGHT, this.settledMaxY)
        : self.fitTargetHeight
    },
  }
}

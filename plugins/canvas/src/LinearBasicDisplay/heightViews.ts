import { snapFittedContentHeight } from './fitLadder.ts'
import { countTruncatedFeatures, maxBottom } from './layoutQueries.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitStage } from './fitLadder.ts'

// Floor for GROW mode's target height, so a sparse or empty track doesn't shrink
// the track to a sliver. Nothing to do with the fit ladder, which never
// resizes the track at all — `growTargetHeight` is its only reader, and the
// mixin's `growMaxHeight` slot is the ceiling at the other end of the clamp.
const MIN_GROW_HEIGHT = 50

/**
 * What the height and scroll geometry reads off the display that installs it:
 * the ladder's kept rung, the morph hold, the on-screen set and the mixins'
 * height answers.
 */
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

/**
 * The drawing height, the scroll extent and grow mode's target, as one
 * `.views()` layer (ADR-041).
 */
export function heightViews(self: HeightHost) {
  return {
    /**
     * #getter
     */
    // The settled laid-out content height, ignoring any in-flight Y morph.
    // The DRAWING height: the canvas, the overlay layer and the peptide lane
    // are sized from it through `contentHeight`, so it has to cover every
    // laid-out feature — a buffered feature packed below the viewport still
    // gets its box and its label, it is simply not somewhere a scroll can go
    // (`scrollExtentMaxY`). This is also what `grow` mode sizes the track to,
    // so it must NOT include the morph hold below, or the track would bounce
    // to the taller of old/new content for the morph's duration and then
    // collapse.
    //
    // Fit mode reads it off `fitStage` rather than re-walking the map:
    // `contentHeight` is the kept rung's unscaled height over
    // `fitMeasureFeatureIds` and `scaleLaidOutData` multiplies every bottomPx
    // by the same scale, so a fitted track reports the height of what it is
    // showing rather than of the buffer around it, epsilon-snapped so a
    // grow/squeeze scale doesn't spuriously scroll. `fitTargetHeight` is the
    // config slot, not the reactive `height` getter, so grow's
    // `height`→grownHeight→settledMaxY chain can't cycle back on itself.
    //
    // The other two modes measure the whole pack instead: their stage
    // contentHeight is now narrowed to the on-screen set too
    // (`fitMeasureFeatureIds`), which is right for choosing the rung and
    // wrong for sizing a canvas that draws the buffer.
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
      // During a Y morph hold the height at the taller of the old/new
      // layout so features animating up from a deeper row aren't clipped at
      // the bottom; it settles to the destination height when the morph
      // ends. Constant across the morph, so no per-frame reflow. This is the
      // DRAWING height — the canvas, the overlay layer and the peptide lane
      // are all sized from it, so it covers every laid-out feature. What can
      // be scrolled TO is `scrollExtentMaxY`, which is narrower. Grow-mode
      // sizing reads settledMaxY so the track height doesn't bounce
      // mid-morph.
      return self.morphFromTops === undefined
        ? this.settledMaxY
        : Math.max(this.settledMaxY, self.morphFromMaxY)
    },

    /**
     * #getter
     */
    // How deep the content a scroll can actually REACH goes: the deepest row
    // occupied by a feature on screen, rather than by one in the fetch
    // buffer.
    //
    // The fetch buffers half a viewport either side and the pack places
    // every buffered feature, so a viewport holding eight genes can carry a
    // stack twenty rows deep whose bottom twelve rows draw nothing in view.
    // Measuring the scroll extent over the whole stack offered a scroll
    // gesture that revealed blank canvas, and — since the scrollbar and the
    // edge shadow are both readouts of this one number — told the reader
    // features were hidden below a track that was showing all of them. The
    // figure review caught it three times in one pass.
    //
    // Same set and same 500ms debounce the fit ladder measures over
    // (`onScreenFeatureIds`), so a pan re-measures once it settles. Fit mode
    // is already narrowed at the source — `settledMaxY` measures the kept
    // rung over `fitMeasureFeatureIds` and epsilon-snaps a scale's float
    // slack — so it reuses that rather than re-walking the map unsnapped.
    //
    // `settledMaxY`, NOT the morph-aware `maxY`: the morph hold exists so a
    // feature easing up from a deeper row isn't clipped, which is about what
    // is DRAWN. `morphFromMaxY` is measured over the whole buffered pack, so
    // reading it here put a scrollbar and a bottom shadow over blank canvas
    // for the morph's 300ms — the exact defect the on-screen narrowing above
    // exists to prevent, reached through the fit branch.
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
    // Features the packer could not place at all because the stack passed
    // GranularRectLayout's row limit. They are not scrolled-out-of-view, they
    // are absent: nothing draws or hit-tests them, and `maxY` doesn't count
    // them, so without this the display reports "everything fits" while
    // showing strictly less than its data. Fit mode is where this bites — its
    // whole promise is that every feature is in view — so the track-sizing
    // affordance surfaces it (see TrackHeightIndicator's tooltip).
    //
    // Over `fitMeasureFeatureIds`, like every other measurement the ladder
    // takes — so fit and fixed count the viewport and grow counts the whole
    // pack. The tooltip tells the user to filter or zoom in, and a count
    // including the fetch buffer said that about features a pan would have
    // shown.
    get truncatedFeatureCount() {
      return countTruncatedFeatures(
        self.laidOutDataMap,
        self.fitMeasureFeatureIds,
      )
    },

    /**
     * #getter
     */
    // Coordinate-space height of what is DRAWN: the laid-out content (maxY)
    // but never less than the viewport, so the canvas, the overlay layer and
    // the peptide lane share one definition (was `hasOverflow ? maxY :
    // height`). A buffered feature packed below the viewport still gets its
    // box and its label drawn at full size here — it is simply not somewhere
    // a scroll can go, which is `scrollContentHeight`.
    get contentHeight() {
      return Math.max(this.maxY, self.height)
    },

    /**
     * #getter
     */
    // The same coordinate space as `contentHeight`, measured over the rows a
    // scroll can reach. This is what the scrollbar and the edge shadow are
    // sized from: both exist to answer "is this track showing me all of its
    // features", and a buffered feature off the side of the viewport is not
    // an answer to that question.
    get scrollContentHeight() {
      return Math.max(this.scrollExtentMaxY, self.height)
    },

    /**
     * #getter
     */
    // How far the content can scroll: 0 when everything on screen fits.
    // Single source for the wheel handler and any scroll clamp, and the hook
    // TrackHeightMixin's clamp is earned by overriding — so a pan into a
    // sparser window pulls the scroll offset back to the new bottom rather
    // than stranding the viewport over blank canvas.
    get scrollableHeight() {
      return Math.max(0, this.scrollExtentMaxY - self.height)
    },

    /**
     * #getter
     */
    // HeightModeMixin's grow hook: the height the laid-out stack wants,
    // before the mixin's own `growMaxHeight` cap. That is the settled content
    // height (settledMaxY, NOT the morph-inflated maxY — grow must target the
    // destination height so it doesn't bounce during a zoom morph), floored
    // at MIN_GROW_HEIGHT so a sparse track doesn't collapse to a sliver.
    //
    // With no layout at all — data not landed yet, or the too-large banner
    // up — the content height is unknown rather than zero, so the track
    // holds the configured slot height instead. The floor is a claim about
    // sparse DATA; applied here it squeezed the too-large banner into a
    // 50px sliver and bounced every grow track slot→floor→content on load.
    //
    // Height-independent — settledMaxY reads the config-slot
    // `fitTargetHeight`, never the reactive `height` getter — which is what
    // lets the mixin's `height` return this in grow mode without cycling.
    // `grownHeight`, the `height` override and the grow-aware `resizeHeight`
    // all come from the mixin.
    get growTargetHeight() {
      return self.layoutReady
        ? Math.max(MIN_GROW_HEIGHT, this.settledMaxY)
        : self.fitTargetHeight
    },
  }
}

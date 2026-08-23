import { computeYTicks } from '@jbrowse/wiggle-core'

import { makeWiggleRenderState } from './wiggleComponentUtils.ts'

import type { WiggleRenderStateModel } from './wiggleComponentUtils.ts'

/**
 * Where a wiggle-family display puts its plot inside its own height. The two
 * displays differ in this and (almost) nothing else: single-wiggle insets by
 * the scalebar label gutter so its end labels aren't clipped and draws one row,
 * multi-wiggle stacks `numRows` rows edge-to-edge over the full height.
 *
 * One value because the halves have to move together — the render height, the
 * on-screen canvas box, the SVG clip group and `computeYTicks`' offset — or the
 * axis ends up labelling data it is not drawn against.
 */
export interface WigglePlotGeometry {
  /** top of the plot canvas within the display, and the axis's own inset */
  yTop: number
  /** height of the plot canvas: the full stack, not one row */
  plotHeight: number
  numRows: number
  /** the box one row's axis is laid out in, `yTop` twice over included */
  tickHeight: number
}

/** What the shared views below read off the display that installs them. */
export interface WiggleDisplayViewsHost extends WiggleRenderStateModel {
  id: string
  canvasWidthPx: number
  plotGeometry: WigglePlotGeometry
  minimalTicks: boolean
  posColor: string
  negColor: string
  isDensityMode: boolean
  effectiveSummaryScoreMode: string
  maxGapMultiple: number
  resolution: number
  /**
   * Whether one color ramp describes the whole plot. Density is the only
   * rendering that spends color on the score, and each display has its own
   * reason a ramp can still be the wrong legend there.
   */
  scoreRampApplies: boolean
}

/**
 * The views both wiggle displays state identically once `plotGeometry` names
 * what they disagree about. Installed as a `.views()` layer of its own, under
 * the layer where each display spreads `sharedRpcProps`/`sharedGpuProps` into
 * the parts that are genuinely its own: single-wiggle's solid-color override,
 * multi-wiggle's row list and its `summaryScoreMode` fetch key.
 *
 * A plain function rather than another mixin: `types.compose` depth is a real
 * ceiling in these chains (ADR-041), and a mixin composed beside
 * `TrackHeightMixin` and `MultiRegionDisplayMixin` cannot see the `height` and
 * `canvasWidthPx` every getter here reads without casting to reach them.
 */
export function wiggleDisplayViews(self: WiggleDisplayViewsHost) {
  return {
    /**
     * #getter
     */
    get ticks() {
      const { tickHeight, yTop } = self.plotGeometry
      return computeYTicks({
        symlogConstant: self.symlogConstant,
        height: tickHeight,
        domain: self.domain,
        scaleType: self.scaleType,
        minimalTicks: self.minimalTicks,
        offset: yTop,
      })
    },

    /**
     * #getter
     * The color ramp the density legend draws, or undefined when there is no
     * single ramp to describe. Lives on the model so the on-screen legend and
     * the SVG export can't disagree about whether density has a ramp.
     */
    get scoreRamp() {
      return self.scoreRampApplies
        ? {
            posColor: self.posColor,
            negColor: self.negColor,
            pivot: self.bicolorPivot,
            gradientId: `score-ramp-${self.id}`,
          }
        : undefined
    },

    /**
     * #getter
     */
    get renderState() {
      const { plotHeight, numRows } = self.plotGeometry
      return makeWiggleRenderState(self, {
        width: self.canvasWidthPx,
        height: plotHeight,
        numRows,
      })
    },

    /**
     * #method
     * The fetch cache keys both displays share, spread into each display's own
     * `rpcProps()`. `bicolorPivot` is one because the worker owns the avg-path
     * pos/neg split (ADR-016), so moving the pivot changes what comes back.
     *
     * Named apart from `rpcProps` rather than overridden through it: MST
     * *intersects* what each `.views()` layer returns, so two same-named
     * methods resolve to the first one at the type level however the runtime
     * member behaves.
     */
    sharedRpcProps() {
      return {
        bicolorPivot: self.bicolorPivot,
        resolution: self.resolution,
      }
    },

    /**
     * #method
     * The encoder inputs both displays share — everything but the row list,
     * which is what each has its own idea of. Spread into each display's own
     * `gpuProps()`; see `sharedRpcProps` for why it isn't an override.
     */
    sharedGpuProps() {
      return {
        posColor: self.posColor,
        negColor: self.negColor,
        effectiveSummaryScoreMode: self.effectiveSummaryScoreMode,
        renderingType: self.renderingType,
        isDensityMode: self.isDensityMode,
        bicolorPivot: self.bicolorPivot,
        maxGapMultiple: self.maxGapMultiple,
      }
    },
  }
}

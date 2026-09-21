import { scoreRampScale } from './scoreRampScale.ts'
import { makeWiggleRenderState } from './wiggleComponentUtils.ts'

import type { ResolvedWiggleColor } from './wiggleColor.ts'
import type { WiggleRenderStateModel } from './wiggleComponentUtils.ts'
import type { RampScale } from '@jbrowse/core/ui/colorScale'

/**
 * Where a wiggle-family display puts its plot inside its own height: one plot
 * box insets by the scalebar label gutter so its end labels aren't clipped, a
 * faceted stack puts `numRows` rows edge-to-edge over the full height.
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
  /** The `color` object resolved against the origin and the layout. */
  wiggleColor: ResolvedWiggleColor
  effectiveSummaryScoreMode: string
  maxGapMultiple: number
  resolution: number
  scoreField: string
  /**
   * Whether one color ramp describes the whole plot: a gradient outside the
   * line renderings, or density's fade. Each display has its own reason a
   * ramp can still be the wrong legend.
   */
  scoreRampApplies: boolean
}

/**
 * The views a wiggle-family display states once `plotGeometry` names where its
 * plot sits. Installed as a `.views()` layer of its own, under the layer where
 * the display spreads `sharedRpcProps`/`sharedGpuProps` into its own
 * `rpcProps()`/`gpuProps()` — the solid-colour override, the row list and the
 * `summaryScoreMode` fetch key.
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
     * The score ramp as a color scale, or undefined when there is no single
     * ramp to describe or no domain yet. `LegendMixin`'s `colorScales` lists
     * it, so the on-screen key and the export draw one bar. The bar is drawn
     * from the resolved colour — the same cached LUT bytes both renderers
     * colour through — so a declared ramp's key is what the track paints.
     */
    get scoreColorScale(): RampScale | undefined {
      return self.scoreRampApplies && self.domain
        ? scoreRampScale(
            self.domain,
            self.scaleType,
            self.symlogConstant,
            self.wiggleColor,
          )
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
     * The fetch cache keys, spread into the display's own
     * `rpcProps()`. The colour settings are not among them: every mode
     * partitions by sign on the main thread, so moving the pivot re-encodes
     * and refetches nothing.
     *
     * Named apart from `rpcProps` rather than overridden through it: MST
     * *intersects* what each `.views()` layer returns, so two same-named
     * methods resolve to the first one at the type level however the runtime
     * member behaves.
     */
    sharedRpcProps() {
      return {
        resolution: self.resolution,
        scoreField: self.scoreField,
      }
    },

    /**
     * #method
     * The encoder inputs — everything but the row list and the facet. Spread
     * into the display's `gpuProps()`; see `sharedRpcProps` for why it isn't an
     * override.
     */
    sharedGpuProps() {
      return {
        wiggleColor: self.wiggleColor,
        origin: self.origin,
        effectiveSummaryScoreMode: self.effectiveSummaryScoreMode,
        renderingType: self.renderingType,
        maxGapMultiple: self.maxGapMultiple,
      }
    },
  }
}

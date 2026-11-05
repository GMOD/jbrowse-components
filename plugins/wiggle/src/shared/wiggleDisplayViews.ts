import { makeWiggleRenderState } from './wiggleComponentUtils.ts'

import type { ResolvedWiggleColor } from './wiggleColor.ts'
import type { WiggleRenderStateModel } from './wiggleComponentUtils.ts'

/**
 * Where a wiggle-family display puts its plot inside its own height: one plot
 * box insets by the scalebar label gutter so its end labels aren't clipped, a
 * stack of rows puts `numRows` rows edge-to-edge over the full height.
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
  canvasWidthPx: number
  plotGeometry: WigglePlotGeometry
  /** The `color` object resolved against the origin and the layout. */
  wiggleColor: ResolvedWiggleColor
  /** The heading of the score key: the color's legend title, else the axis title. */
  colorKeyTitle: string
}

/**
 * The views a wiggle-family display states once `plotGeometry` names where its
 * plot sits. Installed as a `.views()` layer of its own.
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
    get renderState() {
      const { plotHeight, numRows } = self.plotGeometry
      return makeWiggleRenderState(self, {
        width: self.canvasWidthPx,
        height: plotHeight,
        numRows,
      })
    },
  }
}

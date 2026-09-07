import { PaintLayer } from '@jbrowse/core/util/paintLayer'

import {
  canvasLabelMeasurer,
  drawOffscreenMates,
  offscreenMateColors,
} from '../../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateStrip } from '../../LinearSyntenyViewHelper/offscreenMateStrip.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

// One layer for the whole level, after every display's ribbons, as the
// on-screen overlay is stacked over all of them. No strips, no layer: the
// raster branch would otherwise put a full-band transparent PNG in every
// level of every export.
export default function SVGOffscreenMates({
  strips,
  width,
  height,
  groundColor,
  opts,
}: {
  strips: OffscreenMateStrip[]
  width: number
  height: number
  groundColor: string
  opts?: PaintLayerOpts
}) {
  return strips.length > 0 ? (
    <PaintLayer
      width={width}
      height={height}
      opts={opts}
      paint={ctx => {
        drawOffscreenMates(ctx, strips, {
          measure: canvasLabelMeasurer(),
          ...offscreenMateColors(groundColor),
        })
      }}
    />
  ) : null
}

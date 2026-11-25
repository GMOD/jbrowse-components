import { useExportFontFamily } from '@jbrowse/core/svg/constants'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'

import {
  canvasLabelMeasurer,
  drawOffscreenMateLabels,
  fillOffscreenMateMarks,
  offscreenMateColors,
  offscreenMateMarks,
} from '../../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { OffscreenMateStrip } from '../../LinearSyntenyViewHelper/offscreenMateStrip.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

// One pair of layers for the whole level, after every display's ribbons, as
// the on-screen overlay is stacked over all of them: the marks, then their
// labels without `opts`, so the names stay text over rasterized marks. No
// marks, no layers: the raster branch would otherwise put a full-band
// transparent PNG in every level of every export.
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
  const fontFamily = useExportFontFamily()
  const marks = offscreenMateMarks(strips)
  const colors = offscreenMateColors(groundColor)
  return marks.length > 0 ? (
    <>
      <PaintLayer
        width={width}
        height={height}
        opts={opts}
        paint={ctx => {
          fillOffscreenMateMarks(ctx, marks, colors.markColor)
        }}
      />
      <PaintLayer
        width={width}
        height={height}
        paint={ctx => {
          drawOffscreenMateLabels(ctx, marks, {
            ...colors,
            fontFamily,
            measure: canvasLabelMeasurer(fontFamily),
          })
        }}
      />
    </>
  ) : null
}

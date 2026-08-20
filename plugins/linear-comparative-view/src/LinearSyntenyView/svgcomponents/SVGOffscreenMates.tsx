import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { useTheme } from '@mui/material'

import {
  drawOffscreenMates,
  offscreenMateColors,
} from '../../LinearSyntenyDisplay/drawOffscreenMates.ts'
import { offscreenMateStrips } from '../../LinearSyntenyViewHelper/offscreenMateStrip.ts'

import type { OffscreenMateSource } from '../../LinearSyntenyViewHelper/offscreenMateStrip.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

/**
 * The marks for this level's off-screen mates, baked into the figure.
 *
 * `showOffscreenMates` is a menu setting, so an export taken with it on has to
 * carry it — the same rule the color-by legend follows. Without this a figure
 * of a view reporting "2,767 alignments map to 9 contigs not shown" showed the
 * ribbons alone, and the marks the reader turned on to see were the one thing
 * the file did not have.
 *
 * ONE LAYER FOR THE WHOLE LEVEL, after every display's ribbons, because on
 * screen these are a canvas stacked over all of them. Drawn per display it
 * would sit under the next display's band instead.
 */
export default function SVGOffscreenMates({
  level,
  width,
  height,
  opts,
}: {
  level: OffscreenMateSource
  width: number
  height: number
  opts?: PaintLayerOpts
}) {
  const theme = useTheme()
  const strips = offscreenMateStrips(level)
  // nothing to mark, so no layer at all: the raster branch would otherwise put
  // a full-band transparent PNG in every level of every export
  return strips.length > 0 ? (
    <PaintLayer
      width={width}
      height={height}
      opts={opts}
      paint={ctx => {
        for (const strip of strips) {
          drawOffscreenMates(ctx, {
            ...strip,
            width,
            height,
            ...offscreenMateColors(theme),
          })
        }
      }}
    />
  ) : null
}

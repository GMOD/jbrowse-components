import { SvgCanvas } from './SvgCanvas.ts'
import { createSvgRasterCanvas } from './createSvgRasterCanvas.ts'

import type { SvgRasterCanvasOpts } from './createSvgRasterCanvas.ts'
import type React from 'react'

// #region ctx2d
// Shared 2D-context type for the SVG-export draw pipeline. Real
// CanvasRenderingContext2D when rasterizing to PNG; SvgCanvas when emitting
// vector. Most plugin draw functions duck-type against this union.
export type Ctx2D = CanvasRenderingContext2D | SvgCanvas
// #endregion

export type PaintLayerOpts = SvgRasterCanvasOpts & {
  rasterizeLayers?: boolean
}

/**
 * Paint into either a 2× rasterize canvas (PNG-embedded as <image>) or an
 * SvgCanvas (serialized into a <g>). Renders one element — callers don't
 * branch on which mode was picked.
 *
 * Used by every renderSvg.tsx that has a heavy draw path: the same `paint`
 * callback runs on both surfaces, with `paint(ctx)` doing whatever drawing
 * the plugin needs in logical coordinates (the raster canvas is pre-scaled, so
 * callbacks never deal with devicePixelRatio). Width 0 or height 0 falls
 * through to the vector branch (canvas creation rejects 0×0).
 *
 * A vector layer whose `paint` drew nothing renders nothing — not an empty
 * `<g>`. Layers are routinely conditional on data (a highlight pass with no
 * highlighted feature, a legend-less track, a band that is switched off), and
 * every such layer was leaving a stray group in the file for a reader to open
 * and find empty. The raster branch has no cheap equivalent — asking whether a
 * canvas is blank means reading its pixels back — and it does not need one: a
 * fully transparent PNG is a couple of hundred bytes.
 */
export function PaintLayer({
  width,
  height,
  opts,
  paint,
}: {
  width: number
  height: number
  opts?: PaintLayerOpts
  paint: (ctx: Ctx2D) => void
}): React.ReactNode {
  if (opts?.rasterizeLayers && width > 0 && height > 0) {
    const { canvas, ctx } = createSvgRasterCanvas(width, height, opts)
    paint(ctx)
    return (
      <image
        width={width}
        height={height}
        xlinkHref={canvas.toDataURL('image/png')}
      />
    )
  }
  const svg = new SvgCanvas()
  paint(svg)
  const markup = svg.getSerializedSvg()
  return markup ? (
    // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
    <g dangerouslySetInnerHTML={{ __html: markup }} />
  ) : null
}

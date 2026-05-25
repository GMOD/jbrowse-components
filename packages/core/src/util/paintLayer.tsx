import type React from 'react'

import { SvgCanvas } from './SvgCanvas.ts'
import { createSvgRasterCanvas } from './createSvgRasterCanvas.ts'

import type { SvgRasterCanvasOpts } from './createSvgRasterCanvas.ts'

// Shared 2D-context type for the SVG-export draw pipeline. Real
// CanvasRenderingContext2D when rasterizing to PNG; SvgCanvas when emitting
// vector. Most plugin draw functions duck-type against this union.
export type Ctx2D = CanvasRenderingContext2D | SvgCanvas

export type PaintLayerOpts = SvgRasterCanvasOpts & {
  rasterizeLayers?: boolean
}

/**
 * Paint into either a 2× rasterize canvas (PNG-embedded as <image>) or an
 * SvgCanvas (serialized into a <g>). Returns one ReactNode — callers don't
 * branch on which mode was picked.
 *
 * Used by every renderSvg.tsx that has a heavy draw path: the same `paint`
 * callback runs on both surfaces, with `paint(ctx)` doing whatever drawing
 * the plugin needs. Width 0 or height 0 falls through to the vector branch
 * (canvas creation rejects 0×0).
 */
export function paintLayer(
  width: number,
  height: number,
  opts: PaintLayerOpts | undefined,
  paint: (ctx: Ctx2D) => void,
): React.ReactNode {
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
  return <g dangerouslySetInnerHTML={{ __html: svg.getSerializedSvg() }} />
}

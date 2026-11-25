import { saveAs } from '../util/FileSaver/index.ts'
import { fittedRasterScale } from '../util/createSvgRasterCanvas.ts'
import {
  CSS_PX_PER_INCH,
  EXPORT_RASTER_DPI,
  sizeSvgForRaster,
  svgRootIsPhysical,
} from './figureSize.ts'

export interface SaveSvgAsImageOptions {
  format?: string
  filename?: string
}

// Supersample factor for PNG rasterization. The vector text/gridlines/rulers
// rasterize crisply at this scale, and the heavy track layers are already
// embedded as 2× rasters (see createSvgRasterCanvas), so a 1× output canvas
// would otherwise *downsample* them back to screen resolution. Kept at 2× to
// match that embedded DPR: a higher factor sharpens vector text further but
// upscales the 2× rasters (blur), and inflates the canvas toward browser size
// limits.
const PNG_SCALE = 2

// Rasterizes an SVG string to a PNG Blob by routing through a hidden <img>
// + Canvas2D, at a lower resolution where the one asked for is past the
// canvas limits. Rejects with the actual underlying cause so bug reports
// distinguish "SVG failed to load" (usually malformed markup) from
// "canvas.toBlob returned null" (rasterized image exceeded browser limits).
export function svgHtmlToPngBlob(
  html: string,
  scale = PNG_SCALE,
): Promise<Blob> {
  const wanted = svgRootIsPhysical(html)
    ? EXPORT_RASTER_DPI / CSS_PX_PER_INCH
    : scale
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([sizeSvgForRaster(html, { pxScale: scale })], {
      type: 'image/svg+xml',
    })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      // Everything here runs in an event handler, so a throw would escape the
      // promise instead of rejecting it and leave the export dialog spinning
      // forever with nothing said — the hang `awaitViewInitialized` cures on
      // the other end of this pipeline. Reject explicitly instead.
      try {
        const canvas = document.createElement('canvas')
        const cssWidth = img.width / wanted
        const cssHeight = img.height / wanted
        const fitted = fittedRasterScale(cssWidth, cssHeight, wanted)
        const w = Math.floor(cssWidth * Math.max(fitted, 1))
        const h = Math.floor(cssHeight * Math.max(fitted, 1))
        // stated once: both the context and the blob give out at this size,
        // and both failures are silent (a null, not a throw)
        const tooLarge = `The image may be too large (${w}x${h}). Try reducing the view size or use SVG format.`
        if (fitted < 1) {
          throw new Error(`Failed to create PNG. ${tooLarge}`)
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          // browsers hand back a null 2d context rather than throwing once the
          // canvas exceeds their area limit
          throw new Error(`Failed to create PNG rendering context. ${tooLarge}`)
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error(`Failed to create PNG. ${tooLarge}`))
          }
        }, 'image/png')
      } catch (e) {
        reject(e instanceof Error ? e : new Error(`${e}`))
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = event => {
      URL.revokeObjectURL(url)
      const detail = typeof event === 'string' ? event : 'image load failed'
      reject(new Error(`Failed to load SVG for PNG conversion: ${detail}`))
    }
    img.src = url
  })
}

// Shared "save the rendered SVG" sink used by every view's `exportSvg`
// action. `format: 'png'` rasterizes through svgHtmlToPngBlob; anything else
// (default) saves the raw SVG markup.
export async function saveSvgAsImage(
  html: string,
  opts: SaveSvgAsImageOptions = {},
) {
  if (opts.format === 'png') {
    const blob = await svgHtmlToPngBlob(html)
    saveAs(blob, opts.filename ?? 'image.png')
  } else {
    saveAs(
      new Blob([html], { type: 'image/svg+xml' }),
      opts.filename ?? 'image.svg',
    )
  }
}

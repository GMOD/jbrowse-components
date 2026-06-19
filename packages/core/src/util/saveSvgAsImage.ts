import { saveAs } from './FileSaver/index.ts'

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

// Bump the root <svg> width/height by `scale` while leaving viewBox alone, so
// the browser re-rasterizes the *vector* content natively at the higher
// resolution. Drawing the unscaled <img> with drawImage(...,w*scale,h*scale)
// instead would only stretch the 1×-rasterized bitmap (blurry text, resample
// artifacts on the embedded rasters).
function scaleSvgMarkup(html: string, scale: number) {
  return html.replace(/<svg\b[^>]*>/, tag =>
    tag
      .replace(
        /(\bwidth=")([\d.]+)(")/,
        (_m, p, n, s) => `${p}${+n * scale}${s}`,
      )
      .replace(
        /(\bheight=")([\d.]+)(")/,
        (_m, p, n, s) => `${p}${+n * scale}${s}`,
      ),
  )
}

// Rasterizes an SVG string to a PNG Blob by routing through a hidden <img>
// + Canvas2D. Rejects with the actual underlying cause so bug reports
// distinguish "SVG failed to load" (usually malformed markup) from
// "canvas.toBlob returned null" (rasterized image exceeded browser limits).
export function svgHtmlToPngBlob(
  html: string,
  scale = PNG_SCALE,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([scaleSvgMarkup(html, scale)], {
      type: 'image/svg+xml',
    })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const w = img.width
      const h = img.height
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob)
        } else {
          reject(
            new Error(
              `Failed to create PNG. The image may be too large (${w}x${h}). Try reducing the view size or use SVG format.`,
            ),
          )
        }
      }, 'image/png')
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

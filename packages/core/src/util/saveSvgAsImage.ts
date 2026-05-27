import { saveAs } from './FileSaver/index.ts'

export interface SaveSvgAsImageOptions {
  format?: string
  filename?: string
}

// Rasterizes an SVG string to a PNG Blob by routing through a hidden <img>
// + Canvas2D. Rejects with the actual underlying cause so bug reports
// distinguish "SVG failed to load" (usually malformed markup) from
// "canvas.toBlob returned null" (rasterized image exceeded browser limits).
export function svgHtmlToPngBlob(html: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([html], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob)
        } else {
          reject(
            new Error(
              `Failed to create PNG. The image may be too large (${img.width}x${img.height}). Try reducing the view size or use SVG format.`,
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

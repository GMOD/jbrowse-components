// SVG export's "rasterize a layer to PNG" idiom: a 2× DPR canvas drawn into,
// then embedded as <image xlinkHref={dataURL}/>. Used by every renderSvg.tsx
// that has heavy fill paths (alignments pileup, wiggle bins, hic matrix, LD
// matrix, etc.) where vector output would be unreasonably large.
//
// Fixed at 2× — exports go to print/file, not screen, so devicePixelRatio is
// not the right scale factor.
const SVG_RASTER_DPR = 2

export interface SvgRasterCanvasOpts {
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}

export function createSvgRasterCanvas(
  width: number,
  height: number,
  opts: SvgRasterCanvasOpts | undefined,
) {
  const dpr = SVG_RASTER_DPR
  const canvas = opts?.createCanvas
    ? opts.createCanvas(width * dpr, height * dpr)
    : document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('createSvgRasterCanvas: 2D context unavailable')
  }
  ctx.scale(dpr, dpr)
  return { canvas, ctx }
}

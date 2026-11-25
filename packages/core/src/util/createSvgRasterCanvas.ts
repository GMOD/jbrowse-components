// SVG export's "rasterize a layer to PNG" idiom: a canvas drawn into, then
// embedded as <image xlinkHref={dataURL}/>. Used by every renderSvg.tsx that has
// heavy fill paths (alignments pileup, wiggle bins, hic matrix, LD matrix, etc.)
// where vector output would be unreasonably large.
//
// Exports go to print and file, so a layer rasterizes at 2× whatever the
// screen's devicePixelRatio. A layer too big for 2× drops to what fits the
// browsers' canvas limits. Past 2^28 px of area Chrome hands back a context
// that draws nothing, and 32767 px is under every browser's per-axis limit.
const SVG_RASTER_DPR = 2
export const MAX_SVG_RASTER_AREA_PX = 2 ** 28
const MAX_SVG_RASTER_DIM_PX = 32767

export interface SvgRasterCanvasOpts {
  /**
   * headless canvas factory for `rasterizeLayers` (jbrowse-img passes one);
   * without it the raster path needs a DOM canvas
   */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
  /**
   * decodes SVG markup into an image a `createCanvas` canvas can draw, where
   * the environment's `Image` cannot (node, jsdom). A headless decoder draws
   * vectors only, so markup headed for it carries no rasterized layers.
   */
  decodeSvg?: (markup: string) => Promise<CanvasImageSource>
  /**
   * backing px per CSS px a layer asks for, in place of 2×: an export sized
   * for a page asks for what prints at its dpi
   */
  rasterScale?: number
}

/**
 * The backing px per CSS px a `width`x`height` raster gets: `wanted` where
 * that fits under `maxAreaPx` and the per-axis limit, and less where it does
 * not.
 */
export function fittedRasterScale(
  width: number,
  height: number,
  wanted: number,
  maxAreaPx = MAX_SVG_RASTER_AREA_PX,
) {
  return Math.min(
    wanted,
    MAX_SVG_RASTER_DIM_PX / width,
    MAX_SVG_RASTER_DIM_PX / height,
    Math.sqrt(maxAreaPx / (width * height)),
  )
}

/**
 * A canvas for one rasterized export layer of `width`x`height` CSS px, drawn in
 * CSS px. Its backing store is 2× where that fits under `maxAreaPx` and the
 * per-axis limit, and smaller where it does not, so read `canvas.width` for the
 * scale it got.
 */
export function createSvgRasterCanvas(
  width: number,
  height: number,
  opts: SvgRasterCanvasOpts | undefined,
  maxAreaPx = MAX_SVG_RASTER_AREA_PX,
) {
  const scale = fittedRasterScale(
    width,
    height,
    opts?.rasterScale ?? SVG_RASTER_DPR,
    maxAreaPx,
  )
  const backingW = Math.max(1, Math.floor(width * scale))
  const backingH = Math.max(1, Math.floor(height * scale))
  const canvas = opts?.createCanvas
    ? opts.createCanvas(backingW, backingH)
    : document.createElement('canvas')
  canvas.width = backingW
  canvas.height = backingH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('createSvgRasterCanvas: 2D context unavailable')
  }
  ctx.scale(backingW / width, backingH / height)
  return { canvas, ctx }
}

/**
 * The PNG data URL of an export raster. A canvas the browser could not
 * allocate encodes to `data:,`, an image of nothing, so this throws and the
 * export dialog shows the error.
 */
export function svgRasterDataUrl(canvas: HTMLCanvasElement) {
  const url = canvas.toDataURL('image/png')
  if (url === 'data:,') {
    throw new Error(
      `Could not rasterize a ${canvas.width}x${canvas.height} px export layer; export a smaller view`,
    )
  }
  return url
}

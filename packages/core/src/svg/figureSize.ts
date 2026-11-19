export const CSS_PX_PER_INCH = 96
export const EXPORT_RASTER_DPI = 300
export const DEFAULT_FIGURE_TEXT_PT = 7

const UNITS_PER_INCH = { mm: 25.4, cm: 2.54, in: 1 } as const

export type FigureUnit = keyof typeof UNITS_PER_INCH

export interface PhysicalWidth {
  value: number
  unit: FigureUnit
}

function isFigureUnit(unit: string): unit is FigureUnit {
  return unit in UNITS_PER_INCH
}

export function parsePhysicalWidth(text: string): PhysicalWidth | undefined {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([a-z]+)\s*$/i.exec(text)
  const value = Number(match?.[1])
  const unit = match?.[2]?.toLowerCase() ?? ''
  return isFigureUnit(unit) && value > 0 ? { value, unit } : undefined
}

export function physicalWidthInches({ value, unit }: PhysicalWidth) {
  return value / UNITS_PER_INCH[unit]
}

export function pxToPt(px: number) {
  return (px * 72) / CSS_PX_PER_INCH
}

/**
 * The layout of a figure `pageWidth` wide whose `labelPx` text prints at
 * `textPt`: the document is laid out `documentPx` wide in the export's own px
 * and the root's physical width scales it by `scale`, so every size in it
 * keeps its ratio to the text. `chromePx` is what the document spends on
 * margins and gutters, the rest being the plot.
 */
export function resolveFigureSize({
  pageWidth,
  textPt,
  labelPx,
  chromePx,
}: {
  pageWidth: PhysicalWidth
  textPt: number
  labelPx: number
  chromePx: number
}) {
  const pagePx = physicalWidthInches(pageWidth) * CSS_PX_PER_INCH
  const scale = textPt / pxToPt(labelPx)
  const documentPx = pagePx / scale
  return {
    scale,
    documentPx,
    plotPx: Math.floor(documentPx - chromePx),
    rasterScale: (EXPORT_RASTER_DPI / CSS_PX_PER_INCH) * scale,
  }
}

function trimmed(value: number) {
  return +value.toFixed(2)
}

/** The root `<svg>`'s width and height for a document `width`x`height` px. */
export function physicalRootSize(
  { value, unit }: PhysicalWidth,
  width: number,
  height: number,
) {
  return {
    width: `${value}${unit}`,
    height: `${trimmed((value * height) / width)}${unit}`,
  }
}

const ROOT_TAG = /<svg\b[^>]*>/

function rootAttribute(tag: string, name: string) {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]
}

/** Whether the markup's root states its width in a physical unit. */
export function svgRootIsPhysical(html: string) {
  const tag = ROOT_TAG.exec(html)?.[0] ?? ''
  return parsePhysicalWidth(rootAttribute(tag, 'width') ?? '') !== undefined
}

/**
 * The markup with its root sized in device px for rasterizing: a root in
 * physical units at `dpi`, a unitless one at `pxScale` times its px. The
 * viewBox is left alone, so the browser draws the vectors at that resolution.
 */
export function sizeSvgForRaster(
  html: string,
  { dpi = EXPORT_RASTER_DPI, pxScale = 2 } = {},
) {
  return html.replace(ROOT_TAG, tag => {
    const width = rootAttribute(tag, 'width') ?? ''
    const height = rootAttribute(tag, 'height') ?? ''
    const physical = parsePhysicalWidth(width)
    const [, , boxWidth, boxHeight] = (rootAttribute(tag, 'viewBox') ?? '')
      .split(/[\s,]+/)
      .map(Number)
    const targetWidth = physical
      ? physicalWidthInches(physical) * dpi
      : Number(width) * pxScale
    const targetHeight =
      physical && boxWidth && boxHeight
        ? (targetWidth * boxHeight) / boxWidth
        : Number(height) * pxScale
    return Number.isFinite(targetWidth) && Number.isFinite(targetHeight)
      ? tag
          .replace(/(\swidth=")[^"]*(")/, `$1${Math.round(targetWidth)}$2`)
          .replace(/(\sheight=")[^"]*(")/, `$1${Math.round(targetHeight)}$2`)
      : tag
  })
}

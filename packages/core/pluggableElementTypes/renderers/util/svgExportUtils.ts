import { getSerializedSvg } from '../../../util'

import type { RasterizedImageData } from '../../../util'
import type { ResultsSerializedBase } from '../ServerSideRendererType'

export interface SvgVectorExportResult extends ResultsSerializedBase {
  type: 'svg-vector'
  canvasRecordedData: unknown
  width: number
  height: number
}

export interface SvgRasterExportResult extends ResultsSerializedBase {
  type: 'svg-raster'
  rasterizedImageData: RasterizedImageData
  width: number
  height: number
}

export type SvgExportResult = SvgVectorExportResult | SvgRasterExportResult

export function isSvgVectorExport(
  e: ResultsSerializedBase,
): e is SvgVectorExportResult {
  return e.type === 'svg-vector'
}

export function isSvgRasterExport(
  e: ResultsSerializedBase,
): e is SvgRasterExportResult {
  return e.type === 'svg-raster'
}

export function isSvgExport(e: ResultsSerializedBase): e is SvgExportResult {
  return isSvgVectorExport(e) || isSvgRasterExport(e)
}

export async function convertSvgExportToHtml(
  results: ResultsSerializedBase,
): Promise<ResultsSerializedBase> {
  // Handle vector SVG export
  if (isSvgVectorExport(results)) {
    return {
      ...results,
      html: await getSerializedSvg(results),
    }
  }

  // Handle rasterized SVG export
  if (isSvgRasterExport(results)) {
    const { width, height, dataURL } = results.rasterizedImageData
    return {
      ...results,
      html: `<image width="${width}" height="${height}" href="${dataURL}" />`,
    }
  }

  // No conversion needed for normal rendering or other types
  return results
}

export function hasCanvasRecordedData(
  e: ResultsSerializedBase,
): e is ResultsSerializedBase & {
  canvasRecordedData: unknown
  width: number
  height: number
} {
  return (
    'canvasRecordedData' in e &&
    e.canvasRecordedData !== undefined &&
    'width' in e &&
    'height' in e
  )
}

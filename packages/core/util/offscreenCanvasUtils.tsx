/* eslint-disable react-refresh/only-export-components */

import { isValidElement } from 'react'

import { CanvasSequence } from 'canvas-sequencer'

export interface RasterizedImageData {
  width: number
  height: number
  dataURL: string
}

export async function getSerializedSvg(results: {
  width: number
  height: number
  canvasRecordedData: unknown
}) {
  const { width, height, canvasRecordedData } = results

  // @ts-ignore needs to be ignore not expect error, produces error in build step
  const C2S = await import('canvas2svg')
  const ctx = new C2S.default(width, height)
  const seq = new CanvasSequence(canvasRecordedData)
  seq.execute(ctx)

  // innerHTML strips the outer <svg> element from returned data, we add
  // our own <svg> element in the view's SVG export
  return ctx.getSvg().innerHTML as string
}

/**
 * Converts rasterized image data to a React SVG image element
 */
function createRasterizedImageElement(
  imageData: RasterizedImageData,
): React.ReactElement {
  const { width, height, dataURL } = imageData
  return <image width={width} height={height} href={dataURL} />
}

/**
 * Renders different types of rendering output:
 * - React elements directly
 * - HTML strings via dangerouslySetInnerHTML
 * - Rasterized image data as SVG image elements
 *
 * This component handles both discriminated union types (with 'type' field)
 * and plain rendering objects (for backward compatibility).
 */
export function ReactRendering({
  rendering,
}: {
  rendering: {
    type?: 'svg-vector' | 'svg-raster' | 'normal'
    reactElement?: React.ReactNode
    html?: string
    rasterizedImageData?: RasterizedImageData
  }
}) {
  // Handle discriminated union types
  if (rendering.type === 'svg-raster' && rendering.rasterizedImageData) {
    return createRasterizedImageElement(rendering.rasterizedImageData)
  }

  // Handle rasterized image data (backward compatibility)
  if (rendering.rasterizedImageData) {
    return createRasterizedImageElement(rendering.rasterizedImageData)
  }

  // Handle React element
  if (isValidElement(rendering.reactElement)) {
    return rendering.reactElement
  }

  // Handle HTML string (including svg-vector type)
  return <g dangerouslySetInnerHTML={{ __html: rendering.html || '' }} />
}

export { renderToAbstractCanvas } from './renderToAbstractCanvas'

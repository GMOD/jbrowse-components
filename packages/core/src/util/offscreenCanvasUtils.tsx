/* eslint-disable react-refresh/only-export-components */

import { isValidElement } from 'react'

import { getSerializedSvg } from './offscreenCanvasGetSerializingSvg.ts'

export { renderToAbstractCanvas } from './renderToAbstractCanvas.ts'

export function ReactRendering({
  rendering,
}: {
  rendering: {
    reactElement?: React.ReactNode
    html?: string
  }
}) {
  return isValidElement(rendering.reactElement) ? (
    rendering.reactElement
  ) : (
    <g dangerouslySetInnerHTML={{ __html: rendering.html || '' }} />
  )
}

export { getSerializedSvg } from './offscreenCanvasGetSerializingSvg.ts'
export { SvgCanvas } from './SvgCanvas.ts'

/**
 * Converts a rendering result with canvasRecordedData to one with html.
 * If the rendering already has html or doesn't have canvasRecordedData,
 * it returns the original rendering unchanged.
 */
export async function renderingToSvg<
  T extends { canvasRecordedData?: unknown; html?: string },
>(rendering: T, width: number, height: number): Promise<T> {
  if (rendering.canvasRecordedData && !rendering.html) {
    const html = getSerializedSvg({
      width,
      height,
      canvasRecordedData: rendering.canvasRecordedData,
    })
    return { ...rendering, html }
  }
  return rendering
}

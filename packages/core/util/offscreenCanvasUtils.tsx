/* eslint-disable react-refresh/only-export-components */

import { isValidElement } from 'react'

export { renderToAbstractCanvas } from './renderToAbstractCanvas'

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

export { getSerializedSvg } from './offscreenCanvasGetSerializingSvg'

/**
 * Converts a rendering result with canvasRecordedData to one with html.
 * If the rendering already has html or doesn't have canvasRecordedData,
 * it returns the original rendering unchanged.
 */
export async function renderingToSvg<
  T extends { canvasRecordedData?: unknown; html?: string },
>(rendering: T, width: number, height: number): Promise<T> {
  if (rendering.canvasRecordedData && !rendering.html) {
    const { getSerializedSvg } = await import('./offscreenCanvasGetSerializingSvg')
    const html = await getSerializedSvg({
      width,
      height,
      canvasRecordedData: rendering.canvasRecordedData,
    })
    return { ...rendering, html }
  }
  return rendering
}

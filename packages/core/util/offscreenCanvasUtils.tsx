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

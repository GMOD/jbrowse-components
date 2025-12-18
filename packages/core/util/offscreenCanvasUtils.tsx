/* eslint-disable react-refresh/only-export-components */

import { isValidElement } from 'react'

import { CanvasSequence } from 'canvas-sequencer-ts'

export { renderToAbstractCanvas } from './renderToAbstractCanvas'

export async function getSerializedSvg(results: {
  width: number
  height: number
  canvasRecordedData: unknown
}) {
  const { width, height, canvasRecordedData } = results

  // @ts-ignore needs to be ignore not expect error, produces error in build step
  const C2S = await import('canvas2svg')
  const ctx = new C2S.default(width, height)
  const seq = new CanvasSequence(canvasRecordedData as any)
  seq.execute(ctx)

  // innerHTML strips the outer <svg> element from returned data, we add
  // our own <svg> element in the view's SVG export
  return ctx.getSvg().innerHTML as string
}

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

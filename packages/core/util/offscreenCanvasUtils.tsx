/* eslint-disable react-refresh/only-export-components */

import { isValidElement } from 'react'

import { CanvasSequence } from 'canvas-sequencer'

import { blobToDataURL } from './blobToDataURL'
import { createCanvas, createImageBitmap } from './offscreenCanvasPonyfill'

interface ExportSVGOptions {
  rasterizeLayers?: boolean
  scale?: number
}

interface RenderToAbstractCanvasOptions {
  exportSVG?: ExportSVGOptions
  highResolutionScaling?: number
}

type R<T extends Record<string, unknown> | undefined> = Omit<T, never> &
  (
    | { canvasRecordedData: Record<string, unknown> }
    | { imageData: any }
    | { reactElement: React.ReactElement }
    | { rasterizedImageData: { width: number; height: number; dataURL: string } }
  )

export async function renderToAbstractCanvas<
  T extends Record<string, unknown> | undefined,
>(
  width: number,
  height: number,
  opts: RenderToAbstractCanvasOptions,
  cb: (ctx: CanvasRenderingContext2D) => Promise<T> | T,
): Promise<R<T>> {
  const { exportSVG, highResolutionScaling = 1 } = opts

  if (exportSVG) {
    if (!exportSVG.rasterizeLayers) {
      const fakeCtx = new CanvasSequence()
      const callbackResult = await cb(fakeCtx)
      return {
        ...callbackResult,
        canvasRecordedData: fakeCtx.toJSON() as Record<string, unknown>,
      }
    } else {
      const s = exportSVG.scale || highResolutionScaling
      const canvas = createCanvas(Math.ceil(width * s), height * s)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('2d canvas rendering not supported on this platform')
      }
      ctx.scale(s, s)
      const callbackResult = await cb(ctx)

      // Convert canvas to data URL
      // Two methods needed for converting canvas to PNG, one for webworker
      // offscreen canvas, one for main thread
      const imageData =
        'convertToBlob' in canvas
          ? await blobToDataURL(
              await canvas.convertToBlob({
                type: 'image/png',
              }),
            )
          : canvas.toDataURL('image/png')

      // Return serializable image data instead of React element
      // The React element will be constructed on the client side
      return {
        ...callbackResult,
        rasterizedImageData: {
          width,
          height,
          dataURL: imageData,
        },
      }
    }
  } else {
    const s = highResolutionScaling
    const canvas = createCanvas(Math.ceil(width * s), height * s)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('2d canvas rendering not supported on this platform')
    }
    ctx.scale(s, s)
    const callbackResult = await cb(ctx)
    return {
      ...callbackResult,
      imageData: await createImageBitmap(canvas),
    }
  }
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

/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import { CanvasSequence } from 'canvas-sequencer'

// locals
import { blobToDataURL } from './blobToDataURL'
import { createCanvas, createImageBitmap } from './offscreenCanvasPonyfill'

export type RenderReturn = Record<string, unknown> | undefined

type RendererRet = Promise<RenderReturn> | RenderReturn

export async function renderToAbstractCanvas(
  width: number,
  height: number,
  opts: {
    exportSVG?: { rasterizeLayers?: boolean; scale?: number }
    highResolutionScaling?: number
  },
  cb: (ctx: CanvasRenderingContext2D) => RendererRet,
) {
  const { exportSVG, highResolutionScaling = 1 } = opts

  if (exportSVG) {
    if (!exportSVG.rasterizeLayers) {
      const fakeCtx = new CanvasSequence()
      const result = await cb(fakeCtx)
      return {
        ...result,
        canvasRecordedData: fakeCtx.toJSON(),
      }
    } else {
      const s = exportSVG.scale || highResolutionScaling
      const canvas = createCanvas(Math.ceil(width * s), height * s)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('2d canvas rendering not supported on this platform')
      }
      ctx.scale(s, s)
      const result = await cb(ctx)

      // two methods needed for converting canvas to PNG, one for webworker
      // offscreen canvas, one for main thread
      return {
        ...result,
        reactElement: (
          <image
            width={width}
            height={height}
            xlinkHref={
              'convertToBlob' in canvas
                ? await blobToDataURL(
                    await canvas.convertToBlob({
                      type: 'image/png',
                    }),
                  )
                : canvas.toDataURL('image/png')
            }
          />
        ),
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
    const result = await cb(ctx)
    return { ...result, imageData: await createImageBitmap(canvas) }
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
  return React.isValidElement(rendering.reactElement) ? (
    rendering.reactElement
  ) : (
    <g dangerouslySetInnerHTML={{ __html: rendering.html || '' }} />
  )
}

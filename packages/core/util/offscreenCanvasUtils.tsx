import React from 'react'
import { CanvasSequence } from 'canvas-sequencer'

// locals
import { createCanvas, createImageBitmap } from './offscreenCanvasPonyfill'
import { blobToDataURL } from './index'

export type RenderReturn = Record<string, unknown>

export async function renderToAbstractCanvas(
  width: number,
  height: number,
  opts: {
    exportSVG?: { rasterizeLayers?: boolean }
    highResolutionScaling: number
  },
  cb: (
    ctx: CanvasRenderingContext2D,
  ) => Promise<RenderReturn | void> | RenderReturn | void,
) {
  const { exportSVG, highResolutionScaling: scaling = 1 } = opts
  console.log({ exportSVG })

  if (exportSVG) {
    if (!exportSVG.rasterizeLayers) {
      const fakeCtx = new CanvasSequence()
      const result = await cb(fakeCtx)
      return {
        ...result,
        canvasRecordedData: fakeCtx.toJSON(),
      }
    } else {
      const scale = 4
      const canvas = createCanvas(Math.ceil(width * scale), height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('2d canvas rendering not supported on this platform')
      }
      ctx.scale(scale, scale)
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
    const canvas = createCanvas(Math.ceil(width * scaling), height * scaling)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('2d canvas rendering not supported on this platform')
    }
    ctx.scale(scaling, scaling)
    const result = await cb(ctx)
    return { ...result, imageData: await createImageBitmap(canvas) }
  }
}

export async function hydrateSerializedSvg(results: {
  width: number
  height: number
  canvasRecordedData: unknown
}) {
  const { width, height, canvasRecordedData } = results

  const C2S = await import('canvas2svg')
  const ctx = new C2S.default(width, height)
  const seq = new CanvasSequence(canvasRecordedData)
  seq.execute(ctx)
  return ctx.getSvg()
}

export function ReactRendering({
  rendering,
}: {
  rendering: {
    reactElement?: React.ReactNode
    html?: string
  }
}) {
  return (
    <>
      {React.isValidElement(rendering.reactElement) ? (
        rendering.reactElement
      ) : (
        <g
          /* eslint-disable-next-line react/no-danger */
          dangerouslySetInnerHTML={{ __html: rendering.html || '' }}
        />
      )}
    </>
  )
}

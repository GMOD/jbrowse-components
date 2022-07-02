import React from 'react'
import { createCanvas, createImageBitmap } from './offscreenCanvasPonyfill'
import { CanvasSequence } from 'canvas-sequencer'
import { blobToDataURL } from './index'

export async function renderToAbstractCanvas(
  width: number,
  height: number,
  opts: {
    exportSVG?: { rasterizeLayers?: boolean }
    highResolutionScaling: number
  },
  cb: (ctx: CanvasRenderingContext2D) => Promise<void> | void,
) {
  const { exportSVG, highResolutionScaling = 1 } = opts

  if (exportSVG) {
    if (!exportSVG.rasterizeLayers) {
      const fakeCtx = new CanvasSequence()
      await cb(fakeCtx)
      return {
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
      await cb(ctx)

      // two methods needed for converting canvas to PNG, one for webworker
      // offscreen canvas, one for main thread
      return {
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
                : canvas.toDataURL()
            }
          />
        ),
      }
    }
  } else {
    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('2d canvas rendering not supported on this platform')
    }
    ctx.scale(highResolutionScaling, highResolutionScaling)
    await cb(ctx)

    return { imageData: await createImageBitmap(canvas) }
  }
}

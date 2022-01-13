import React from 'react'
import {
  createCanvas,
  PonyfillOffscreenCanvas,
  createImageBitmap,
} from './offscreenCanvasPonyfill'
import { blobToDataURL } from '.'

export async function renderToAbstractCanvas(
  width: number,
  height: number,
  opts: {
    exportSVG?: { rasterizeLayers?: boolean }
    highResolutionScaling: number
  },
  cb: Function,
) {
  const { exportSVG, highResolutionScaling = 1 } = opts
  if (exportSVG && !exportSVG.rasterizeLayers) {
    const fakeCanvas = new PonyfillOffscreenCanvas(width, height)
    const fakeCtx = fakeCanvas.getContext('2d')
    await cb(fakeCtx)
    return {
      reactElement: fakeCanvas.getSerializedSvg(),
    }
  }
  if (exportSVG && exportSVG.rasterizeLayers) {
    const scale = 4
    const canvas = createCanvas(Math.ceil(width * scale), height * scale)
    const ctx = canvas.getContext('2d')
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
            canvas.convertToBlob
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

  const canvas = createCanvas(
    Math.ceil(width * highResolutionScaling),
    height * highResolutionScaling,
  )
  const ctx = canvas.getContext('2d')
  ctx.scale(highResolutionScaling, highResolutionScaling)
  await cb(ctx)

  return { imageData: await createImageBitmap(canvas) }
}

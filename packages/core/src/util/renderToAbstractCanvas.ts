import { CanvasSequence } from 'canvas-sequencer-ts'

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

type RenderResult =
  | { canvasRecordedData: Record<string, unknown> }
  | { imageData: ImageBitmap }
  | { html: string }

export async function renderToAbstractCanvas<T extends object | undefined>(
  width: number,
  height: number,
  opts: RenderToAbstractCanvasOptions,
  cb: (ctx: CanvasRenderingContext2D) => Promise<T> | T,
): Promise<(T extends undefined ? object : T) & RenderResult> {
  const { exportSVG, highResolutionScaling = 1 } = opts

  // Ensure minimum dimensions of 1 because creating a 0-dimension
  // OffscreenCanvas throws "Failed to create ImageBitmap from OffscreenCanvas"
  // when transferToImageBitmap is called
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)

  type Result = (T extends undefined ? object : T) & RenderResult

  if (exportSVG) {
    if (!exportSVG.rasterizeLayers) {
      const fakeCtx = new CanvasSequence()
      const callbackResult = await cb(
        fakeCtx as unknown as CanvasRenderingContext2D,
      )
      return {
        ...callbackResult,
        canvasRecordedData: fakeCtx.toJSON() as Record<string, unknown>,
      } as unknown as Result
    } else {
      const s = exportSVG.scale || highResolutionScaling
      const canvas = createCanvas(
        Math.ceil(safeWidth * s),
        Math.ceil(safeHeight * s),
      )
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('2d canvas rendering not supported on this platform')
      }
      if (s !== 1) {
        ctx.scale(s, s)
      }
      const callbackResult = await cb(ctx)

      // two methods needed for converting canvas to PNG, one for webworker
      // offscreen canvas, one for main thread
      return {
        ...callbackResult,
        html: `<image width="${width}" height="${height}" href="${
          'convertToBlob' in canvas
            ? await blobToDataURL(
                await canvas.convertToBlob({
                  type: 'image/png',
                }),
              )
            : canvas.toDataURL('image/png')
        }" />`,
      } as unknown as Result
    }
  } else {
    const canvas = createCanvas(
      Math.ceil(safeWidth * highResolutionScaling),
      Math.ceil(safeHeight * highResolutionScaling),
    )
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('2d canvas rendering not supported on this platform')
    }
    if (highResolutionScaling !== 1) {
      ctx.scale(highResolutionScaling, highResolutionScaling)
    }
    const callbackResult = await cb(ctx)
    return {
      ...callbackResult,
      imageData: await createImageBitmap(canvas),
    } as unknown as Result
  }
}

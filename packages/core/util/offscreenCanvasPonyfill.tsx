/* eslint-disable react-refresh/only-export-components */
// This file is a ponyfill for the HTML5 OffscreenCanvas API.

import { CanvasSequence } from 'canvas-sequencer-ts'
import isNode from 'detect-node'

// Re-export transferable utilities for convenience
export { collectTransferables, isDetachedBuffer } from './transferables'

export function isImageBitmap(value: unknown): value is ImageBitmap {
  return typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap
}

export function drawImageOntoCanvasContext(
  imageData: any,
  context: CanvasRenderingContext2D,
) {
  if (imageData.serializedCommands) {
    const seq = new CanvasSequence(imageData.serializedCommands)
    seq.execute(context)
  } else {
    context.drawImage(imageData as CanvasImageSource, 0, 0)
  }
}

export function createCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height)
  } else if (isNode) {
    // @ts-expect-error
    return nodeCreateCanvas(width, height)
  } else {
    const context = new CanvasSequence()
    return {
      width,
      height,
      getContext() {
        return context
      },
    }
  }
}

export async function createImageBitmap(canvas: any) {
  if (typeof OffscreenCanvas === 'function') {
    return (canvas as OffscreenCanvas).transferToImageBitmap()
  } else if (isNode) {
    const dataUri = canvas.toDataURL()
    // @ts-expect-error
    const img = new nodeImage()
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = dataUri
    })
  } else {
    const ctx = canvas.getContext('2d')
    return {
      height: canvas.height,
      width: canvas.width,
      serializedCommands: ctx.toJSON(),
    }
  }
}

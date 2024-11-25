/* eslint-disable react-refresh/only-export-components */
// This file is a ponyfill for the HTML5 OffscreenCanvas API.

import { CanvasSequence } from 'canvas-sequencer'
import isNode from 'detect-node'

type AbstractCanvas = any

type AbstractImageBitmap = any

export let createCanvas: (width: number, height: number) => AbstractCanvas
export let createImageBitmap: (
  canvas: AbstractCanvas,
) => Promise<AbstractImageBitmap>

/** the JS class (constructor) for offscreen-generated image bitmap data */
export let ImageBitmapType: unknown

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

const weHave = {
  realOffscreenCanvas: typeof OffscreenCanvas === 'function',
  node: isNode,
}

if (weHave.realOffscreenCanvas) {
  createCanvas = (width, height) => new OffscreenCanvas(width, height)

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  createImageBitmap = window.createImageBitmap || self.createImageBitmap

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  ImageBitmapType = window.ImageBitmap || self.ImageBitmap
} else if (weHave.node) {
  // use node-canvas if we are running in node (i.e. automated tests)
  createCanvas = (...args) => {
    // @ts-expect-error
    return nodeCreateCanvas(...args)
  }
  createImageBitmap = async canvas => {
    const dataUri = canvas.toDataURL()
    // @ts-expect-error
    const img = new nodeImage()
    return new Promise((resolve, reject) => {
      // need onload for jest
      img.onload = () => {
        resolve(img)
      }
      img.onerror = reject
      img.src = dataUri
    })
  }
} else {
  createCanvas = (width: number, height: number) => {
    const context = new CanvasSequence()
    return {
      width,
      height,
      getContext() {
        return context
      },
    }
  }
  createImageBitmap = async canvas => {
    const ctx = canvas.getContext('2d')
    return {
      height: canvas.height,
      width: canvas.width,
      serializedCommands: ctx.toJSON(),
      containsNoTransferables: true,
    }
  }
  ImageBitmapType = String
}

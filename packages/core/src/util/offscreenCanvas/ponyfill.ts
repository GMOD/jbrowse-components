// This file is a ponyfill for the HTML5 OffscreenCanvas API.

import isNode from 'detect-node'
import OffscreenCanvasShim from './CanvasShim'

import {
  AbstractCanvas,
  AbstractImageBitmap,
  CanvasImageDataShim,
  isCanvasImageDataShim,
} from './types'
import type {
  createCanvas as NodeCreateCanvas,
  Canvas as NodeCanvas,
} from 'canvas'
import { replayCommandsOntoContext } from './Canvas2DContextShim/context'

export let createCanvas: (width: number, height: number) => AbstractCanvas
export let createImageBitmap: (
  canvas: AbstractCanvas,
) => Promise<AbstractImageBitmap>

/** the JS class (constructor) for offscreen-generated image bitmap data */
export let ImageBitmapType: Function

export function drawImageOntoCanvasContext(
  imageData: AbstractImageBitmap,
  context: CanvasRenderingContext2D,
) {
  if (isCanvasImageDataShim(imageData)) {
    replayCommandsOntoContext(context, imageData.serializedCommands)
  } else if (imageData instanceof ImageBitmapType) {
    context.drawImage(imageData as CanvasImageSource, 0, 0)
    // @ts-ignore
  } else if (imageData.dataURL) {
    throw new Error('dataURL deserialization no longer supported')
    // const img = new Image()
    // img.onload = () => context.drawImage(img, 0, 0)
    // img.src = imageData.dataURL
  }
}

const weHave = {
  realOffscreenCanvas: typeof OffscreenCanvas === 'function',
  node: isNode,
}
if (weHave.realOffscreenCanvas) {
  createCanvas = (width, height) => new OffscreenCanvas(width, height)
  // @ts-ignore
  createImageBitmap = window.createImageBitmap || self.createImageBitmap
  ImageBitmapType = window.ImageBitmap || self.ImageBitmap
} else if (weHave.node) {
  // use node-canvas if we are running in node (i.e. automated tests)
  const { createCanvas: nodeCreateCanvas, Image } = require('canvas')
  createCanvas = nodeCreateCanvas as typeof NodeCreateCanvas
  createImageBitmap = async (canvas, ...otherargs) => {
    if (otherargs.length) {
      throw new Error(
        'only one-argument uses of createImageBitmap are supported by the node offscreencanvas ponyfill',
      )
    }
    const dataUri = (canvas as NodeCanvas).toDataURL()
    const img = new Image()
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = dataUri
    })
  }
  ImageBitmapType = Image
} else {
  createCanvas = (width, height) => {
    return new OffscreenCanvasShim(width, height)
  }
  createImageBitmap = async canvas => {
    const ctx = (canvas as OffscreenCanvasShim).getContext('2d')
    const d: CanvasImageDataShim = {
      height: ctx.height,
      width: ctx.width,
      serializedCommands: ctx.getSerializedCommands(),
      containsNoTransferables: true,
    }
    return d
  }
  ImageBitmapType = String
}

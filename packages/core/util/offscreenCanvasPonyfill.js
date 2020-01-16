/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable no-restricted-globals */

// This is a ponyfill for the HTML5 OffscreenCanvas API.
export let createCanvas
export let createImageBitmap
export let ImageBitmapType

// sniff environments
const isElectron = !!window.electron

const weHave = {
  realOffscreenCanvas:
    typeof __webpack_require__ === 'function' &&
    typeof OffscreenCanvas === 'function',
  node:
    typeof __webpack_require__ === 'undefined' && typeof process === 'object',
}

// Electron serializes everything to JSON through the IPC boundary, so we just
// send the dataURL
if (isElectron) {
  createCanvas = (width, height) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
  createImageBitmap = async (canvas, ...otherargs) => {
    if (otherargs.length) {
      throw new Error(
        'only one-argument uses of createImageBitmap are supported by the node offscreencanvas ponyfill',
      )
    }
    return { dataURL: canvas.toDataURL() }
  }
  ImageBitmapType = Image
} else if (weHave.realOffscreenCanvas) {
  createCanvas = (width, height) => new OffscreenCanvas(width, height)
  createImageBitmap = window.createImageBitmap || self.createImageBitmap
  ImageBitmapType = window.ImageBitmap || self.ImageBitmap
} else if (weHave.node) {
  // use node-canvas if we are running in node (i.e. automated tests)
  const { createCanvas: nodeCreateCanvas, Image } = require('canvas')
  createCanvas = nodeCreateCanvas
  createImageBitmap = async (canvas, ...otherargs) => {
    if (otherargs.length) {
      throw new Error(
        'only one-argument uses of createImageBitmap are supported by the node offscreencanvas ponyfill',
      )
    }
    const dataUri = canvas.toDataURL()
    const img = new Image()
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = dataUri
    })
  }
  ImageBitmapType = Image
}

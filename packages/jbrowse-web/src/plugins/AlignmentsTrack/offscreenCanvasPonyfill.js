/* eslint-disable global-require */
/* eslint-disable camelcase */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable no-restricted-globals */
export let createCanvas
export let createImageBitmap
export let ImageBitmap
if (typeof __webpack_require__ === 'function') {
  createCanvas = (width, height) => new OffscreenCanvas(width, height)

  createImageBitmap = window.createImageBitmap || self.createImageBitmap
  ImageBitmap = window.ImageBitmap || self.ImageBitmap
} else if (typeof process === 'object') {
  // use node-canvas if we are running in node (i.e. automated tests)
  const { createCanvas: nodeCreateCanvas } = require('canvas')
  createCanvas = nodeCreateCanvas
  createImageBitmap = async (canvas, ...otherargs) => {
    if (otherargs.length)
      throw new Error(
        'only one-argument uses of createImageBitmap are supported by the node offscreencanvas ponyfill',
      )
    const data = canvas.toBuffer('raw')
    return data
  }
  ImageBitmap = Buffer
} else {
  throw new Error(
    'no ponyfill available for OffscreenCanvas in this environment',
  )
}

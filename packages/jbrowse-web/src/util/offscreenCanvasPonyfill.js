/* eslint-disable global-require */
/* eslint-disable camelcase */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable no-restricted-globals */
export let createCanvas
export let createImageBitmap
export let ImageBitmapType
if (
  typeof __webpack_require__ === 'function' &&
  typeof OffscreenCanvas === 'function'
) {
  createCanvas = (width, height) => new OffscreenCanvas(width, height)

  createImageBitmap = window.createImageBitmap || self.createImageBitmap
  ImageBitmapType = window.ImageBitmap || self.ImageBitmap
} else if (typeof process === 'object') {
  // use node-canvas if we are running in node (i.e. automated tests)
  const { createCanvas: nodeCreateCanvas, Image } = require('canvas')
  createCanvas = nodeCreateCanvas
  createImageBitmap = async (canvas, ...otherargs) => {
    if (otherargs.length)
      throw new Error(
        'only one-argument uses of createImageBitmap are supported by the node offscreencanvas ponyfill',
      )
    const dataUri = canvas.toDataURL()
    const img = new Image()
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = dataUri
    })
  }
  ImageBitmapType = Image
} else {
  throw new Error(
    'no ponyfill available for OffscreenCanvas in this environment',
  )
}

// Patch jsdom canvas to use node-canvas for 2D. Skipped when there is no DOM
// (e.g. files with @jest-environment node inside the default jsdom project).
if (typeof HTMLCanvasElement !== 'undefined') {
  const { createCanvas } = require('canvas')

  const nodeCanvasMap = new WeakMap()

  function getNodeCanvas(domCanvas) {
    let entry = nodeCanvasMap.get(domCanvas)
    if (!entry) {
      const nc = createCanvas(300, 150)
      entry = { nc }
      nodeCanvasMap.set(domCanvas, entry)
    }
    return entry.nc
  }

  const origGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (type === '2d') {
      const nc = getNodeCanvas(this)
      return nc.getContext('2d', attrs)
    }
    return origGetContext.call(this, type, attrs)
  }

  const widthDesc = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'width',
  )
  const heightDesc = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'height',
  )

  if (widthDesc?.set) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
      get: widthDesc.get,
      set(v) {
        widthDesc.set.call(this, v)
        const nc = nodeCanvasMap.get(this)?.nc
        if (nc) {
          nc.width = v
        }
      },
      configurable: true,
    })
  }

  if (heightDesc?.set) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
      get: heightDesc.get,
      set(v) {
        heightDesc.set.call(this, v)
        const nc = nodeCanvasMap.get(this)?.nc
        if (nc) {
          nc.height = v
        }
      },
      configurable: true,
    })
  }

  HTMLCanvasElement.prototype.getBoundingClientRect = function () {
    const w = Number(this.getAttribute('width')) || this.width || 300
    const h = Number(this.getAttribute('height')) || this.height || 150
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: w,
      height: h,
      right: w,
      bottom: h,
      toJSON() {
        return this
      },
    }
  }

  HTMLCanvasElement.prototype.toDataURL = function (mimeType, quality) {
    const nc = nodeCanvasMap.get(this)?.nc
    if (nc) {
      return nc.toDataURL(mimeType, quality)
    }
    return 'data:,'
  }
}

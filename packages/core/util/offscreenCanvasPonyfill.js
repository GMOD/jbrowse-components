/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable no-restricted-globals */
import React from 'react'
import Path from 'svg-path-generator'

// This is a ponyfill for the HTML5 OffscreenCanvas API.
export let createCanvas
export let createImageBitmap
export let ImageBitmapType

// sniff environments
const isElectron = typeof window !== 'undefined' && Boolean(window.electron)

const weHave = {
  realOffscreenCanvas:
    typeof __webpack_require__ === 'function' &&
    typeof OffscreenCanvas === 'function',
  node:
    typeof __webpack_require__ === 'undefined' && typeof process === 'object',
}

export class PonyfillOffscreenContext {
  constructor() {
    this.commands = []
    this.currentFont = '12px Courier New, monospace'
  }

  // setters (no getters working)
  set strokeStyle(style) {
    this.commands.push({ type: 'strokeStyle', style })
  }

  set fillStyle(style) {
    this.commands.push({ type: 'fillStyle', style })
  }

  set font(style) {
    this.currentFont = style
    this.commands.push({ type: 'font', style })
  }

  // methods
  arc(...args) {
    this.commands.push({ type: 'arc', args })
  }

  arcTo(...args) {
    this.commands.push({ type: 'arcTo', args })
  }

  beginPath(...args) {
    this.commands.push({ type: 'beginPath', args })
  }

  clearRect(...args) {
    this.commands.push({ type: 'clearRect', args })
  }

  clip(...args) {
    this.commands.push({ type: 'clip', args })
  }

  closePath(...args) {
    this.commands.push({ type: 'closePath', args })
  }

  createLinearGradient(...args) {
    this.commands.push({ type: 'createLinearGradient', args })
  }

  createPattern(...args) {
    this.commands.push({ type: 'createPattern', args })
  }

  createRadialGradient(...args) {
    this.commands.push({ type: 'createRadialGradient', args })
  }

  drawFocusIfNeeded(...args) {
    this.commands.push({ type: 'drawFocusIfNeeded', args })
  }

  drawImage(...args) {
    this.commands.push({ type: 'drawImage', args })
  }

  ellipse(...args) {
    this.commands.push({ type: 'ellipse', args })
  }

  fill(...args) {
    this.commands.push({ type: 'fill', args })
  }

  fillRect(...args) {
    this.commands.push({ type: 'fillRect', args })
  }

  fillText(...args) {
    this.commands.push({ type: 'fillText', args })
  }

  lineTo(...args) {
    this.commands.push({ type: 'lineTo', args })
  }

  measureText(text) {
    const height = +this.currentFont.match(/\d+/)[0]
    return {
      width: (height / 2) * text.length,
      height,
    }
  }

  moveTo(...args) {
    this.commands.push({ type: 'moveTo', args })
  }

  quadraticCurveTo(...args) {
    this.commands.push({ type: 'quadraticCurveTo', args })
  }

  rect(...args) {
    this.commands.push({ type: 'rect', args })
  }

  restore(...args) {
    this.commands.push({ type: 'restore', args })
  }

  rotate(...args) {
    this.commands.push({ type: 'rotate', args })
  }

  save(...args) {
    this.commands.push({ type: 'save', args })
  }

  setLineDash(...args) {
    this.commands.push({ type: 'setLineDash', args })
  }

  setTransform(...args) {
    this.commands.push({ type: 'setTransform', args })
  }

  scale(...args) {
    this.commands.push({ type: 'scale', args })
  }

  stroke(...args) {
    this.commands.push({ type: 'stroke', args })
  }

  strokeRect(...args) {
    this.commands.push({ type: 'strokeRect', args })
  }

  strokeText(...args) {
    this.commands.push({ type: 'strokeText', args })
  }

  transform(...args) {
    this.commands.push({ type: 'transform', args })
  }

  translate(...args) {
    this.commands.push({ type: 'translate', args })
  }

  // unsupported
  //   putImageData(...args)
  //   createImageData(...args)
  //   getImageData(...args)
  //   getLineDash(...args)
  //   getTransform(...args)
}

export class PonyfillOffscreenCanvas {
  constructor(width, height) {
    this.width = width
    this.height = height
  }

  getContext(type) {
    if (type !== '2d') throw new Error(`unknown type ${type}`)
    this.context = new PonyfillOffscreenContext()
    return this.context
  }

  getSerializedSvg() {
    let currentFill
    let currentPath = []
    let initial

    const nodes = []
    this.context.commands.forEach((command, index) => {
      if (command.type === 'fillStyle') {
        if (command.style) {
          currentFill = command.style
        }
      }
      if (command.type === 'fillRect') {
        const [x, y, w, h] = command.args
        nodes.push(
          <rect
            key={index}
            fill={currentFill}
            x={x}
            y={y}
            width={w}
            height={h}
          />,
        )
      }
      if (command.type === 'beginPath') {
        currentPath = []
      }
      if (command.type === 'moveTo') {
        currentPath.push(command.args)
        initial = [...command.args]
      }
      if (command.type === 'lineTo') {
        currentPath.push(command.args)
      }
      if (command.type === 'closePath') {
        /* do nothing */
      }
      if (command.type === 'fill') {
        let path = Path().moveTo(...currentPath[0])
        for (let i = 1; i < currentPath.length; i++) {
          path = path.lineTo(...currentPath[i])
        }
        path.end()
        nodes.push(<path fill={currentFill} d={path} />)
      }
    })
    return <>{[...nodes]}</>
  }
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
} else {
  createCanvas = (width, height) => {
    return new PonyfillOffscreenCanvas(width, height)
  }
  createImageBitmap = canvas => {
    return canvas.context
  }
  ImageBitmapType = typeof 'StringArray'
}

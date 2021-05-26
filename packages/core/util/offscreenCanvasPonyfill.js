/* eslint-disable no-restricted-globals */
import React from 'react'
import Path from 'svg-path-generator'
import Color from 'color'

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
  constructor(width, height) {
    this.width = width
    this.height = height
    this.commands = []
    this.currentFont = '12px Courier New, monospace'
  }

  // setters (no getters working)
  set strokeStyle(style) {
    if (style !== this.currentStrokeStyle) {
      this.commands.push({ type: 'strokeStyle', style })
      this.currentStrokeStyle = style
    }
  }

  set fillStyle(style) {
    if (style !== this.currentFillStyle) {
      this.commands.push({ type: 'fillStyle', style })
      this.currentFillStyle = style
    }
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
    const [x, y, w, h] = args
    if (x > this.width || x + w < 0) {
      return
    }
    const nx = Math.max(x, 0)
    const nw = nx + w > this.width ? this.width - nx : w
    this.commands.push({ type: 'fillRect', args: [nx, y, nw, h] })
  }

  fillText(...args) {
    // if (x > this.width || x + 1000 < 0) {
    //   return
    // }
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

function splitColor(color) {
  const fill = Color(color)
  return { hex: fill.hex(), opacity: fill.alpha() }
}

// https://stackoverflow.com/a/5620441/2129219
function parseFont(font) {
  let fontFamily = null
  let fontSize = null
  let fontStyle = 'normal'
  let fontWeight = 'normal'
  let fontVariant = 'normal'
  let lineHeight = 'normal'

  const elements = font.split(/\s+/)
  let element
  outer: while ((element = elements.shift())) {
    switch (element) {
      case 'normal':
        break

      case 'italic':
      case 'oblique':
        fontStyle = element
        break

      case 'small-caps':
        fontVariant = element
        break

      case 'bold':
      case 'bolder':
      case 'lighter':
      case '100':
      case '200':
      case '300':
      case '400':
      case '500':
      case '600':
      case '700':
      case '800':
      case '900':
        fontWeight = element
        break

      default:
        if (!fontSize) {
          const parts = element.split('/')
          fontSize = parts[0]
          if (parts.length > 1) {
            lineHeight = parts[1]
          }
          break
        }

        fontFamily = element
        if (elements.length) {
          fontFamily += ` ${elements.join(' ')}`
        }
        break outer
    }
  }

  return {
    fontStyle,
    fontVariant,
    fontWeight,
    fontSize,
    lineHeight,
    fontFamily,
  }
}
export class PonyfillOffscreenCanvas {
  constructor(width, height) {
    this.width = width
    this.height = height
  }

  getContext(type) {
    if (type !== '2d') {
      throw new Error(`unknown type ${type}`)
    }
    this.context = new PonyfillOffscreenContext(this.width, this.height)
    return this.context
  }

  getSerializedSvg() {
    let currentFill
    let currentStroke
    let currentPath = []
    let rotation
    let font

    const nodes = []
    this.context.commands.forEach((command, index) => {
      if (command.type === 'font') {
        if (command.style) {
          // stackoverflow.com/questions/5618676
          // skip lineHeight in the final usage
          const { fontStyle, fontFamily, fontSize } = parseFont(command.style)
          font = { fontStyle, fontFamily, fontSize }
        }
      }
      if (command.type === 'fillStyle') {
        if (command.style) {
          currentFill = command.style
        }
      }
      if (command.type === 'strokeStyle') {
        if (command.style) {
          currentStroke = command.style
        }
      }
      if (command.type === 'fillRect') {
        const [x, y, w, h] = command.args
        const { hex, opacity } = splitColor(currentFill)
        const ny = Math.min(y, y + h)
        const nh = Math.abs(h)
        nodes.push(
          <rect
            key={index}
            fill={hex}
            fillOpacity={opacity !== 1 ? opacity : undefined}
            x={x.toFixed(3)}
            y={ny.toFixed(3)}
            width={w.toFixed(3)}
            height={nh.toFixed(3)}
          />,
        )
      }
      if (command.type === 'fillText') {
        const [text, x, y] = command.args
        const { hex, opacity } = splitColor(currentFill)
        nodes.push(
          <text
            key={index}
            fill={hex}
            fillOpacity={opacity !== 1 ? opacity : undefined}
            x={x.toFixed(3)}
            y={y.toFixed(3)}
            {...font}
          >
            {text}
          </text>,
        )
      }
      if (command.type === 'beginPath') {
        currentPath = []
      }
      if (command.type === 'moveTo') {
        currentPath.push(command.args)
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
        const { hex, opacity } = splitColor(currentFill)
        nodes.push(
          <path
            key={index}
            fill={hex}
            d={path}
            fillOpacity={opacity !== 1 ? opacity : undefined}
          />,
        )
      }
      if (command.type === 'stroke') {
        let path = Path().moveTo(...currentPath[0])
        for (let i = 1; i < currentPath.length; i++) {
          path = path.lineTo(...currentPath[i])
        }
        path.end()
        const { hex, opacity } = splitColor(currentStroke)
        nodes.push(
          <path
            key={index}
            fill="none"
            stroke={hex}
            fillOpacity={opacity !== 1 ? opacity : undefined}
            d={path}
          />,
        )
      }
      if (command.type === 'rotate') {
        rotation = (command.args[0] * 180) / Math.PI
      }
    })
    return rotation ? (
      <g transform={`rotate(${rotation})`}>{[...nodes]}</g>
    ) : (
      <>{[...nodes]}</>
    )
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

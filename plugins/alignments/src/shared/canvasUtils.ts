/**
 * Shared canvas drawing utilities for LinearRead displays
 */

// Map of named colors to hex values
const namedColors: Record<string, string> = {
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  teal: '#008080',
  purple: '#800080',
  grey: '#808080',
  gray: '#808080',
  white: '#ffffff',
  black: '#000000',
  pink: '#ffc0cb',
}

// avoid drawing negative width features for SVG exports
export function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  fillColor?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (fillColor) {
    ctx.fillStyle = fillColor
  }

  ctx.fillRect(x, y, width, height)
}

export function strokeRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  strokeColor?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor
  }
  ctx.strokeRect(x, y, width, height)
}

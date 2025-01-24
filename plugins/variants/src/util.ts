// avoid drawing negative width features for SVG exports
export function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  color?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (color) {
    ctx.fillStyle = color
  }
  ctx.fillRect(x, y, width, height)
}

export function getCol(gt: string) {
  if (gt === '0|0' || gt === '0/0') {
    return '#ccc'
  } else if (gt === '1|0' || gt === '0|1' || gt === '0/1' || gt === '1/0') {
    return 'teal'
  } else if (gt === '1|1' || gt === '1/1') {
    return 'blue'
  } else {
    return '#CBC3E3'
  }
}

export const colorPaletteDefault = [
  'red',
  'blue',
  'green',
  'orange',
  'purple',
  'cyan',
  'pink',
  'darkblue',
  'darkred',
  'pink',
]

export function randomColor(str: string) {
  let sum = 0

  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  return `hsl(${sum * 10}, 20%, 50%)`
}

import { polarToCartesian } from '@jbrowse/core/util'

/**
 * Where a chord or ribbon's outline goes: an SVG `d` string for the export and
 * the highlight paths, a 2D context for the canvas the resting shapes are
 * painted on. One trace per shape, two sinks, so the two can never disagree
 * about where a ribbon is.
 */
export interface PathSink {
  moveTo(radius: number, radians: number): void
  /** along the circle at `radius`, from one angle to the next */
  arcTo(from: number, to: number, radius: number): void
  quadTo(cx: number, cy: number, radius: number, radians: number): void
  close(): void
}

function point(radius: number, radians: number) {
  const [x, y] = polarToCartesian(radius, radians)
  return `${x} ${y}`
}

export function svgPathSink() {
  const parts: string[] = []
  return {
    moveTo(radius: number, radians: number) {
      parts.push(`M ${point(radius, radians)}`)
    },
    arcTo(from: number, to: number, radius: number) {
      const largeArc = Math.abs(to - from) > Math.PI ? 1 : 0
      const sweep = to > from ? 1 : 0
      parts.push(
        `A ${radius} ${radius} 0 ${largeArc} ${sweep} ${point(radius, to)}`,
      )
    },
    quadTo(cx: number, cy: number, radius: number, radians: number) {
      parts.push(`Q ${cx} ${cy} ${point(radius, radians)}`)
    },
    close() {
      parts.push('Z')
    },
    toString() {
      return parts.join(' ')
    },
  }
}

export function canvasPathSink(ctx: CanvasRenderingContext2D): PathSink {
  return {
    moveTo(radius, radians) {
      const [x, y] = polarToCartesian(radius, radians)
      ctx.moveTo(x, y)
    },
    arcTo(from, to, radius) {
      ctx.arc(0, 0, radius, from, to, to < from)
    },
    quadTo(cx, cy, radius, radians) {
      const [x, y] = polarToCartesian(radius, radians)
      ctx.quadraticCurveTo(cx, cy, x, y)
    },
    close() {
      ctx.closePath()
    },
  }
}

import { polarToCartesian } from '@jbrowse/core/util'

import type { MarkContext2D } from '@jbrowse/render-core/marks'

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
  // An arc whose two ends meet draws nothing in SVG, so a full turn, or one
  // rounding short of it, goes as halves.
  const arcTo = (from: number, to: number, radius: number) => {
    if (Math.abs(to - from) > Math.PI) {
      const mid = (from + to) / 2
      arcTo(from, mid, radius)
      arcTo(mid, to, radius)
    } else {
      const sweep = to > from ? 1 : 0
      parts.push(`A ${radius} ${radius} 0 0 ${sweep} ${point(radius, to)}`)
    }
  }
  return {
    moveTo(radius: number, radians: number) {
      parts.push(`M ${point(radius, radians)}`)
    },
    lineTo(radius: number, radians: number) {
      parts.push(`L ${point(radius, radians)}`)
    },
    arcTo,
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

// A quadratic's cubic is the same curve, its controls two thirds of the way
// from each end to the one control
export function canvasPathSink(ctx: MarkContext2D): PathSink {
  let lastX = 0
  let lastY = 0
  const at = (x: number, y: number) => {
    lastX = x
    lastY = y
  }
  return {
    moveTo(radius, radians) {
      const [x, y] = polarToCartesian(radius, radians)
      ctx.moveTo(x, y)
      at(x, y)
    },
    arcTo(from, to, radius) {
      ctx.arc(0, 0, radius, from, to, to < from)
      const [x, y] = polarToCartesian(radius, to)
      at(x, y)
    },
    quadTo(cx, cy, radius, radians) {
      const [x, y] = polarToCartesian(radius, radians)
      ctx.bezierCurveTo(
        lastX + (2 / 3) * (cx - lastX),
        lastY + (2 / 3) * (cy - lastY),
        x + (2 / 3) * (cx - x),
        y + (2 / 3) * (cy - y),
        x,
        y,
      )
      at(x, y)
    },
    close() {
      ctx.closePath()
    },
  }
}

/** The arc at `radius` from one turn to another, as an SVG path. */
export function arcPath(radius: number, from: number, to: number) {
  const sink = svgPathSink()
  sink.moveTo(radius, from)
  sink.arcTo(from, to, radius)
  return sink.toString()
}

/** The annular sector between two radii over a span of turns, as an SVG path. */
export function sectorPath(
  innerPx: number,
  outerPx: number,
  from: number,
  to: number,
) {
  const sink = svgPathSink()
  sink.moveTo(outerPx, from)
  sink.arcTo(from, to, outerPx)
  sink.lineTo(innerPx, to)
  sink.arcTo(to, from, innerPx)
  sink.close()
  return sink.toString()
}

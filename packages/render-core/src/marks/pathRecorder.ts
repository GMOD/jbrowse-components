import type { MarkContext2D } from './types.ts'

const ELLIPSE_SEGMENTS = 48

/**
 * A 2D context that records what a painter traces as one SVG path, with the
 * widest stroke and the dash it stroked with, so a highlight lies on the ink a
 * shape painted rather than on a second tracing of it. Transforms are not
 * followed; a painter that sets one records untransformed.
 */
export function recordPath() {
  const parts: string[] = []
  let dash: number[] = []
  let strokedDash: number[] = []
  let strokedWidth = 0
  const ctx: MarkContext2D = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    save() {},
    restore() {},
    clip() {},
    beginPath() {},
    translate() {},
    scale() {},
    rotate() {},
    rect(x, y, w, h) {
      parts.push(`M${x} ${y}h${w}v${h}h${-w}Z`)
    },
    fillRect(x, y, w, h) {
      this.rect(x, y, w, h)
    },
    strokeRect(x, y, w, h) {
      this.rect(x, y, w, h)
    },
    moveTo(x, y) {
      parts.push(`M${x} ${y}`)
    },
    lineTo(x, y) {
      parts.push(`L${x} ${y}`)
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      parts.push(`C${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`)
    },
    arc(x, y, r, start, end) {
      this.ellipse(x, y, r, r, 0, start, end)
    },
    ellipse(x, y, rx, ry, _rotation, start, end) {
      for (let k = 0; k <= ELLIPSE_SEGMENTS; k++) {
        const a = start + ((end - start) * k) / ELLIPSE_SEGMENTS
        parts.push(`L${x + rx * Math.cos(a)} ${y + ry * Math.sin(a)}`)
      }
    },
    setLineDash(segments) {
      dash = segments
    },
    closePath() {
      parts.push('Z')
    },
    fill() {},
    stroke() {
      strokedWidth = Math.max(strokedWidth, this.lineWidth)
      if (dash.length > 0) {
        strokedDash = dash
      }
    },
  }
  return {
    ctx,
    get d() {
      return parts.join('')
    },
    /** The widest stroke traced, 0 for a shape that only fills. */
    get lineWidth() {
      return strokedWidth
    },
    get dash() {
      return strokedDash.length > 0 ? strokedDash.join(' ') : undefined
    },
  }
}

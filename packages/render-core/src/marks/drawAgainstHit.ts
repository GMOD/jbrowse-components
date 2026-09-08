import type { RenderBlock } from '../renderBlock.ts'
import type { MarkContext2D, MarkFrame, MarkShape } from './types.ts'

export interface RecordedRect {
  x: number
  y: number
  w: number
  h: number
  // The context's own style type, not `string`: a recorder that narrowed it
  // would have to cast on every read of the property it is recording.
  fillStyle: MarkContext2D['fillStyle']
}

// The CTM, in Canvas2D's own `[a, b, c, d, e, f]` order. A recorder that left
// this out could not see a painter that places its ink through the transform
// stack, and would record it at the untransformed coordinates while the hit test
// answers at the real ones — the coverage band's layers are exactly that shape,
// anchored at the band top and translated down to it.
type Ctm = [number, number, number, number, number, number]

const IDENTITY: Ctm = [1, 0, 0, 1, 0, 0]

/**
 * A `MarkContext2D` that records every rect a painter fills, in paint order and
 * in CANVAS coordinates — `fillRect` and path `rect` alike, so a shape that
 * batches by colour records the same list as one that fills per instance. A
 * path traced with `moveTo`/`lineTo`/`bezierCurveTo` and filled records its
 * bounding box, which is what a shape whose hit test answers a polygon's box
 * (the variant inversion triangle) is held to; a curve contributes its control
 * points, whose hull contains it.
 *
 * A **stroked** path records one rect per `moveTo`/`lineTo` edge, each the
 * edge's bounding box widened by half the current `lineWidth` — the extent a
 * round cap reaches on all four sides. Per edge rather than per `stroke()`,
 * because a painter that batches a colour run into one path (dotplot's) would
 * otherwise record the run's hull as a single instance. `fillStyle` on such a
 * record is the `strokeStyle` it went down in; the field is the colour of the
 * ink either way.
 *
 * `save`/`restore` bracket the transform and the styles the way a real context
 * does, and every recorded point goes through the CTM. The half-widths — a
 * stroke's and a `strokeRect`'s — are measured AFTER it, so they are exact under
 * a translation and approximate under a scale; no shape in tree strokes under
 * one, and a rotated CTM records the ink's axis-aligned box rather than its
 * silhouette.
 */
export function recordingContext() {
  const calls: RecordedRect[] = []
  const points: [number, number][] = []
  const edges: [number, number, number, number][] = []
  let m: Ctm = [...IDENTITY]
  const stack: {
    m: Ctm
    fillStyle: MarkContext2D['fillStyle']
    strokeStyle: MarkContext2D['strokeStyle']
    lineWidth: number
    lineCap: MarkContext2D['lineCap']
  }[] = []
  const px = (x: number, y: number) => m[0] * x + m[2] * y + m[4]
  const py = (x: number, y: number) => m[1] * x + m[3] * y + m[5]
  const pushPoint = (x: number, y: number) => {
    points.push([px(x, y), py(x, y)])
  }
  // The transformed box of an axis-aligned rect. An axis-aligned CTM scales the
  // extents directly rather than differencing two mapped corners, so an
  // untranslated rect records the width the painter asked for and not a value
  // one ulp off it; only a rotation falls back to the four-corner hull.
  const boxOf = (x: number, y: number, w: number, h: number) => {
    if (m[1] === 0 && m[2] === 0) {
      const x0 = px(x, y)
      const y0 = py(x, y)
      const dx = m[0] * w
      const dy = m[3] * h
      return {
        x: Math.min(x0, x0 + dx),
        y: Math.min(y0, y0 + dy),
        w: Math.abs(dx),
        h: Math.abs(dy),
      }
    }
    const xs = [px(x, y), px(x + w, y), px(x, y + h), px(x + w, y + h)]
    const ys = [py(x, y), py(x + w, y), py(x, y + h), py(x + w, y + h)]
    const left = Math.min(...xs)
    const top = Math.min(...ys)
    return {
      x: left,
      y: top,
      w: Math.max(...xs) - left,
      h: Math.max(...ys) - top,
    }
  }
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    save() {
      const { fillStyle, strokeStyle, lineWidth, lineCap } = this
      stack.push({ m: [...m], fillStyle, strokeStyle, lineWidth, lineCap })
    },
    restore() {
      const saved = stack.pop()
      if (saved) {
        m = saved.m
        this.fillStyle = saved.fillStyle
        this.strokeStyle = saved.strokeStyle
        this.lineWidth = saved.lineWidth
        this.lineCap = saved.lineCap
      }
    },
    translate(x: number, y: number) {
      m = [m[0], m[1], m[2], m[3], px(x, y), py(x, y)]
    },
    scale(x: number, y: number) {
      m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]]
    },
    rotate(angle: number) {
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      m = [
        m[0] * c + m[2] * s,
        m[1] * c + m[3] * s,
        m[2] * c - m[0] * s,
        m[3] * c - m[1] * s,
        m[4],
        m[5],
      ]
    },
    beginPath() {
      points.length = 0
      edges.length = 0
    },
    clip() {},
    setLineDash() {},
    moveTo(x: number, y: number) {
      pushPoint(x, y)
    },
    lineTo(x: number, y: number) {
      const from = points.at(-1)
      pushPoint(x, y)
      const to = points.at(-1)!
      if (from) {
        edges.push([from[0], from[1], to[0], to[1]])
      }
    },
    bezierCurveTo(
      cp1x: number,
      cp1y: number,
      cp2x: number,
      cp2y: number,
      x: number,
      y: number,
    ) {
      pushPoint(cp1x, cp1y)
      pushPoint(cp2x, cp2y)
      pushPoint(x, y)
    },
    arc(x: number, y: number, radius: number) {
      pushPoint(x - radius, y - radius)
      pushPoint(x + radius, y + radius)
    },
    ellipse(x: number, y: number, radiusX: number, radiusY: number) {
      pushPoint(x - radiusX, y - radiusY)
      pushPoint(x + radiusX, y + radiusY)
    },
    closePath() {},
    fill() {
      if (points.length > 0) {
        const xs = points.map(p => p[0])
        const ys = points.map(p => p[1])
        const x = Math.min(...xs)
        const y = Math.min(...ys)
        calls.push({
          x,
          y,
          w: Math.max(...xs) - x,
          h: Math.max(...ys) - y,
          fillStyle: this.fillStyle,
        })
        points.length = 0
        edges.length = 0
      }
    },
    stroke() {
      const half = this.lineWidth / 2
      for (const [ax, ay, bx, by] of edges) {
        const x = Math.min(ax, bx) - half
        const y = Math.min(ay, by) - half
        calls.push({
          x,
          y,
          w: Math.max(ax, bx) + half - x,
          h: Math.max(ay, by) + half - y,
          fillStyle: this.strokeStyle,
        })
      }
      points.length = 0
      edges.length = 0
    },
    rect(x: number, y: number, w: number, h: number) {
      calls.push({ ...boxOf(x, y, w, h), fillStyle: this.fillStyle })
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ ...boxOf(x, y, w, h), fillStyle: this.fillStyle })
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      const half = this.lineWidth / 2
      const box = boxOf(x, y, w, h)
      calls.push({
        x: box.x - half,
        y: box.y - half,
        w: box.w + this.lineWidth,
        h: box.h + this.lineWidth,
        fillStyle: this.strokeStyle,
      })
    },
  } satisfies MarkContext2D
  return { ctx, calls }
}

function contains(r: RecordedRect, x: number, y: number) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

/**
 * The draw-against-hit gate for a shape whose instances paint as rects: paint
 * the block, then walk it in `step` px and hold `hitNearest` to what the
 * painter recorded. A hit at distance 0 has to sit on the rect of the index it
 * names, and a point on a rect has to answer that rect — the last-painted one
 * where rects overlap, since the sweep hands candidates in back to front.
 *
 * Returns the violations rather than asserting, so a test reads as
 * `expect(sweep(...)).toEqual([])`. `maxDistSq` is the caller's, because a
 * shape whose hit target is wider than its ink (`point`) needs a bound that
 * admits the whole rect.
 */
export function sweepDrawAgainstHit<C extends { count: number }, P>(
  shape: MarkShape<C, P>,
  channels: C,
  block: RenderBlock,
  frame: MarkFrame,
  params: P,
  { maxDistSq, step = 0.5 }: { maxDistSq: number; step?: number },
) {
  const violations: string[] = []
  const { ctx, calls: rects } = recordingContext()
  shape.paintBlock(ctx, channels, block, frame, params)
  if (rects.length !== channels.count) {
    return [`painted ${rects.length} rects for ${channels.count} instances`]
  }
  const candidates = Array.from(
    { length: channels.count },
    (_, k) => channels.count - 1 - k,
  )
  let yMin = Infinity
  let yMax = -Infinity
  for (const r of rects) {
    yMin = Math.min(yMin, r.y)
    yMax = Math.max(yMax, r.y + r.h)
  }
  const x0 = Math.min(block.screenStartPx, block.screenEndPx) - 1
  const x1 = Math.max(block.screenStartPx, block.screenEndPx) + 1
  for (let y = Math.floor(yMin) - 1; y <= yMax + 1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      let expected = -1
      for (let k = rects.length - 1; k >= 0; k--) {
        if (contains(rects[k]!, x, y)) {
          expected = k
          break
        }
      }
      const hit = shape.hitNearest!(
        channels,
        block,
        frame,
        params,
        x,
        y,
        candidates,
        maxDistSq,
      )
      if (hit && hit.distSq === 0 && !contains(rects[hit.index]!, x, y)) {
        violations.push(
          `(${x}, ${y}) answered ${hit.index} at distance 0, off its rect`,
        )
      }
      if (expected !== -1 && hit?.index !== expected) {
        violations.push(
          `(${x}, ${y}) is on rect ${expected}, answered ${hit?.index ?? 'nothing'}`,
        )
      }
      if (violations.length >= 10) {
        return violations
      }
    }
  }
  return violations
}

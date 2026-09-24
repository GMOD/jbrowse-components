import { inkOnRect } from './markHit.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { Mark, MarkContext2D, MarkFrame, MarkHit } from './types.ts'

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
 * bounding box, the extent a shape whose hit test answers a polygon's box
 * (the variant inversion triangle) is checked against; a curve contributes its control
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
const CURVE_SEGMENTS = 64

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
    arc(x: number, y: number, radius: number, start = 0, end = 2 * Math.PI) {
      this.ellipse(x, y, radius, radius, 0, start, end)
    },
    // Flattened into edges, so a stroked curve records the boxes its
    // segments cover the way a polyline does; a filled one still records its
    // point hull.
    ellipse(
      x: number,
      y: number,
      radiusX: number,
      radiusY: number,
      _rotation = 0,
      start = 0,
      end = 2 * Math.PI,
    ) {
      for (let k = 0; k <= CURVE_SEGMENTS; k++) {
        const a = start + ((end - start) * k) / CURVE_SEGMENTS
        this.lineTo(x + radiusX * Math.cos(a), y + radiusY * Math.sin(a))
      }
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

/** The extent of a painting, in canvas px. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

function contains(r: Box, x: number, y: number, slack = 0) {
  return (
    x >= r.x - slack &&
    x <= r.x + r.w + slack &&
    y >= r.y - slack &&
    y <= r.y + r.h + slack
  )
}

function unionBox(rs: readonly RecordedRect[]) {
  let box: Box | undefined
  for (const r of rs) {
    box = box
      ? {
          x: Math.min(box.x, r.x),
          y: Math.min(box.y, r.y),
          w: Math.max(box.x + box.w, r.x + r.w) - Math.min(box.x, r.x),
          h: Math.max(box.y + box.h, r.y + r.h) - Math.min(box.y, r.y),
        }
      : { x: r.x, y: r.y, w: r.w, h: r.h }
  }
  return box
}

// The float slack the two distance comparisons take. Both sides are px
// arithmetic over the same projection, so a real disagreement is orders of
// magnitude above this and a rounding one is below it.
const EPS = 1e-9

const MAX_VIOLATIONS = 10

interface Counted {
  count: number
}

export interface SweepOptions<C> {
  maxDistSq?: number
  step?: number
  sliceOne?: (channels: C, index: number) => C
  inkSlackPx?: number
  contains?: (index: number, xPx: number, yPx: number) => boolean
}

/**
 * The ink clause of {@link sweepMarkAgainstHit} alone, for a mark with no
 * `hitNearest`: `boxes[i]` is what the painter recorded for instance `i`.
 */
export function inkViolations<C, S extends MarkFrame>(
  mark: Mark<C, S>,
  channels: C,
  block: RenderBlock,
  state: S,
  boxes: readonly (Box | undefined)[],
  inkSlackPx: number,
) {
  const violations: string[] = []
  if (!mark.ink) {
    return violations
  }
  for (let i = 0; i < boxes.length; i++) {
    const r = mark.ink(channels, block, state, i)
    const b = boxes[i]
    if (r && !b) {
      violations.push(`${i} painted nothing but has ink`)
    } else if (b && !r) {
      violations.push(`${i} painted but has no ink`)
    } else if (b && r) {
      const gaps = [
        b.x - r.left,
        r.left + r.width - (b.x + b.w),
        b.y - r.top,
        r.top + r.height - (b.y + b.h),
      ]
      if (gaps.some(g => g < -EPS)) {
        violations.push(
          `${i} painted (${b.x}, ${b.y}, ${b.w}, ${b.h}) outside its ink (${r.left}, ${r.top}, ${r.width}, ${r.height})`,
        )
      } else if (gaps.some(g => g > inkSlackPx + EPS)) {
        violations.push(
          `${i}'s ink (${r.left}, ${r.top}, ${r.width}, ${r.height}) is more than ${inkSlackPx}px outside its painting (${b.x}, ${b.y}, ${b.w}, ${b.h})`,
        )
      }
    }
    if (violations.length >= MAX_VIOLATIONS) {
      return violations
    }
  }
  return violations
}

function hitViolations(
  hit: MarkHit | undefined,
  boxes: readonly (Box | undefined)[],
  x: number,
  y: number,
) {
  const violations: string[] = []
  const box = hit && boxes[hit.index]
  if (hit && !box) {
    violations.push(`(${x}, ${y}) answered ${hit.index}, which painted nothing`)
  } else if (hit && box) {
    if (!contains(box, hit.x, hit.y, EPS)) {
      violations.push(
        `(${x}, ${y}) answered ${hit.index} with ink at (${hit.x}, ${hit.y}), off its painting`,
      )
    }
    const toBox = inkOnRect(x, y, box.x, box.y, box.w, box.h).distSq
    if (hit.distSq < toBox - EPS) {
      violations.push(
        `(${x}, ${y}) answered ${hit.index} at ${hit.distSq}, nearer than its painting (${toBox})`,
      )
    }
    const toPoint = (x - hit.x) ** 2 + (y - hit.y) ** 2
    if (Math.abs(hit.distSq - toPoint) > EPS * Math.max(1, toPoint)) {
      violations.push(
        `(${x}, ${y}) answered ${hit.index} at ${hit.distSq}, which is not the distance to the ink it named (${toPoint})`,
      )
    }
  }
  return violations
}

/**
 * The draw-against-hit gate: paint the block, then walk it in `step` px and
 * hold `hitNearest` to what the painter actually put on the canvas.
 *
 * **What the painter drew for instance `i` has to be attributed to `i`,** and
 * there are two ways to get that. A mark whose every instance is one `fillRect`
 * gets it positionally, which is the default and needs nothing. A mark that
 * batches a colour run into one path (`point`'s glyphs), or that skips an
 * instance the view has scrolled past (`cell`'s off-canvas rows), cannot be read
 * that way at all — the batch has fewer rects than instances, or the wrong ones.
 * `sliceOne` is the way in for those: hand back one instance's channels and the
 * sweep paints it alone, so the attribution holds by construction and a culled
 * instance is visibly an empty painting.
 *
 * Four claims, all of them one-directional and true of every mark:
 *
 * - an instance that painted nothing is never the answer,
 * - `hit.x`/`hit.y` — where the mark says its ink is — lies inside the box the
 *   painter drew for the instance the hit names,
 * - `hit.distSq` is no smaller than the distance to that box, since the box
 *   contains the ink and cannot be farther than it,
 * - `hit.distSq` IS the distance to `hit.x`/`hit.y`, which is `MarkHit`'s own
 *   contract rather than a fact about the painting: a mark that answers a
 *   distance its own reported point does not support has two spellings of where
 *   its ink is, and the nearest-wins walk is resolved by the one the caller
 *   cannot see.
 *
 * The fifth is the containment rule: **a point the rule contains answers the
 * nearest painted instance it contains**, the last-painted where tied, since the
 * sweep hands candidates back to front. The default rule is the painted box, so
 * a point on a box answers that box, and off every box a hit target wider than
 * its ink may still answer. The default holds only where the box IS the hit
 * target — every `fillRect` mark, and `cell`'s inversion triangle, which answers
 * as its bounding box on purpose — and not for a glyph, whose box is a superset
 * of its ink, so it runs exactly when the batch painted one rect per instance. A
 * mark whose hit rule is not its box (the pileup's bp containment) passes
 * `contains`, which is then the whole rule: the sweep covers the whole canvas,
 * and a point the rule contains nowhere answers nothing.
 *
 * A mark declaring `ink` is held to one more clause, per instance: the box the
 * painter recorded for `i` lies inside `ink(i)`, and each edge of `ink(i)` lies
 * within `inkSlackPx` (default 1) of the painting's — so the rect is tight to
 * the ink within a pixel on every side, which admits a seam overdraw or a pixel
 * snap and rejects a rect that is the wrong row, the wrong width or the whole
 * canvas. An instance that painted nothing must answer no ink, and one with ink
 * must have painted.
 *
 * Returns the violations rather than asserting, so a test reads as
 * `expect(sweep(...)).toEqual([])`. `maxDistSq` is the bound the hit test is
 * asked with, `Infinity` unless the caller's differs.
 */
export function sweepMarkAgainstHit<C extends Counted, S extends MarkFrame>(
  mark: Mark<NoInfer<C>, S>,
  channels: C,
  block: RenderBlock,
  state: S,
  {
    maxDistSq = Infinity,
    step = 0.5,
    sliceOne,
    inkSlackPx = 1,
    contains: rule,
  }: SweepOptions<C> = {},
) {
  const { count } = channels
  const paint = (c: C) => {
    const { ctx, calls } = recordingContext()
    mark.paintBlock(ctx, c, block, state)
    return calls
  }
  const rects = paint(channels)
  const perRect = rects.length === count
  if (!perRect && !sliceOne) {
    return [`painted ${rects.length} rects for ${count} instances`]
  }
  const boxes: readonly (Box | undefined)[] = sliceOne
    ? Array.from({ length: count }, (_, i) =>
        unionBox(paint(sliceOne(channels, i))),
      )
    : rects.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h }))
  let yMin = Infinity
  let yMax = -Infinity
  for (const b of boxes) {
    if (b) {
      yMin = Math.min(yMin, b.y)
      yMax = Math.max(yMax, b.y + b.h)
    }
  }
  if (yMin === Infinity) {
    return [`painted nothing for ${count} instances`]
  }

  const violations = inkViolations(
    mark,
    channels,
    block,
    state,
    boxes,
    inkSlackPx,
  )
  if (violations.length >= MAX_VIOLATIONS) {
    return violations
  }
  if (!mark.hitNearest) {
    return ['no hit test']
  }

  const claims =
    rule ??
    (perRect
      ? (k: number, x: number, y: number) => contains(boxes[k]!, x, y)
      : undefined)
  const candidates = Array.from({ length: count }, (_, k) => count - 1 - k)
  const x0 = Math.min(block.screenStartPx, block.screenEndPx) - 1
  const x1 = Math.max(block.screenStartPx, block.screenEndPx) + 1
  const y0 = rule ? -1 : Math.floor(yMin) - 1
  const y1 = rule ? state.canvasHeight + 1 : yMax + 1
  let answered = 0
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      let expected = -1
      let expectedDistSq = maxDistSq
      if (claims) {
        for (const k of candidates) {
          const b = boxes[k]
          if (b && claims(k, x, y)) {
            const distSq = inkOnRect(x, y, b.x, b.y, b.w, b.h).distSq
            if (
              expected === -1
                ? distSq < maxDistSq
                : distSq < expectedDistSq - EPS
            ) {
              expected = k
              expectedDistSq = distSq
            }
          }
        }
      }
      const hit = mark.hitNearest(
        channels,
        block,
        state,
        x,
        y,
        candidates,
        maxDistSq,
      )
      if (hit) {
        answered++
      }
      violations.push(...hitViolations(hit, boxes, x, y))
      if (
        expected === -1
          ? rule !== undefined && hit !== undefined
          : hit?.index !== expected
      ) {
        violations.push(
          `(${x}, ${y}) should answer ${expected === -1 ? 'nothing' : expected}, answered ${hit?.index ?? 'nothing'}`,
        )
      }
      if (violations.length >= MAX_VIOLATIONS) {
        return violations
      }
    }
  }
  return answered === 0 && violations.length === 0
    ? [`no swept point answered any of ${count} instances`]
    : violations
}

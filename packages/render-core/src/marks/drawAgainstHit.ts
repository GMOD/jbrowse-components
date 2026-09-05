import type { RenderBlock } from '../renderBlock.ts'
import type { MarkContext2D, MarkFrame, MarkShape } from './types.ts'

export interface RecordedRect {
  x: number
  y: number
  w: number
  h: number
  fillStyle: string
}

/**
 * A `MarkContext2D` that records every rect a painter fills, in paint order —
 * `fillRect` and path `rect` alike, so a shape that batches by colour records
 * the same list as one that fills per instance.
 */
export function recordingContext() {
  const calls: RecordedRect[] = []
  const ctx = {
    fillStyle: '',
    save() {},
    restore() {},
    beginPath() {},
    clip() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    closePath() {},
    fill() {},
    rect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
  }
  return { ctx: ctx as unknown as MarkContext2D, calls }
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

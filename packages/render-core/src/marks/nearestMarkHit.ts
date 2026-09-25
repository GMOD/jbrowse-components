import { bpAtPxExact } from '../canvas2dUtils.ts'
import { canvasWideBlock } from '../renderBlock.ts'
import { denormalizeScore } from '../scoreScale.ts'
import { valueScaleUniforms } from './valueScale.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { RowParams } from './rowLane.ts'
import type { Mark, MarkFrame, MarkHit } from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * What a cursor's grab radius spans in one block for one mark: the bp, and
 * the values the mark's shape can put ink at, every value for a shape with no
 * `valueWindow`.
 */
export interface HitWindow {
  block: RenderBlock
  bpMin: number
  bpMax: number
  valueMin: number
  valueMax: number
}

const EVERY_VALUE: [number, number] = [-Infinity, Infinity]

/** A {@link MarkHit}, with the mark, block and region it was found in. */
export interface NearestMarkHit<TRegion> extends MarkHit {
  mark: number
  block: RenderBlock
  region: TRegion
}

/**
 * The instance nearest `(xPx, yPx)` within `radiusPx`, over the blocks the
 * radius reaches. Marks are asked last to first and only a strictly nearer hit
 * replaces the best, so a tie goes to the mark on top. `candidates` names what
 * a mark is asked about in a block: what an index finds in the reach, or
 * `backToFront` over every instance. `undefined` leaves the mark out, as a
 * closed gate does. A mark spanning the view is asked first, over every region
 * in `regionKeys` (the blocks' own by default) with an unbounded bp reach,
 * since it paints over every block.
 */
export function nearestMarkHit<TRegion, TState extends MarkFrame>(
  marks: readonly Mark<TRegion, TState>[],
  blocks: readonly RenderBlock[],
  regionOf: (displayedRegionIndex: number) => TRegion | undefined,
  state: TState,
  xPx: number,
  yPx: number,
  {
    radiusPx,
    candidates,
    regionKeys,
  }: {
    radiusPx: number
    regionKeys?: Iterable<number>
    candidates: (
      region: TRegion,
      mark: number,
      reach: HitWindow,
    ) => Iterable<number> | undefined
  },
): NearestMarkHit<TRegion> | undefined {
  let best: NearestMarkHit<TRegion> | undefined
  let bestDistSq = radiusPx * radiusPx
  const ask = (
    m: number,
    block: RenderBlock,
    region: TRegion,
    reach: Omit<HitWindow, 'block' | 'valueMin' | 'valueMax'>,
  ) => {
    const mark = marks[m]!
    if (!mark.hitNearest) {
      return
    }
    const values = mark.valueWindow
      ? mark.valueWindow(region, block, state, yPx, radiusPx)
      : EVERY_VALUE
    const asked =
      values &&
      candidates(region, m, {
        block,
        ...reach,
        valueMin: values[0],
        valueMax: values[1],
      })
    const hit =
      asked &&
      mark.hitNearest(region, block, state, xPx, yPx, asked, bestDistSq)
    if (hit) {
      bestDistSq = hit.distSq
      best = {
        mark: m,
        block,
        region,
        index: hit.index,
        x: hit.x,
        y: hit.y,
        distSq: hit.distSq,
      }
    }
  }
  if (marks.some(m => m.spansView)) {
    for (const key of regionKeys ?? blocks.map(b => b.displayedRegionIndex)) {
      const region = regionOf(key)
      if (region === undefined) {
        continue
      }
      const block = canvasWideBlock(key, state.canvasWidth)
      for (let m = marks.length - 1; m >= 0; m--) {
        if (marks[m]!.spansView) {
          ask(m, block, region, { bpMin: -Infinity, bpMax: Infinity })
        }
      }
    }
  }
  for (const block of blocks) {
    const region = regionOf(block.displayedRegionIndex)
    const widthPx = block.screenEndPx - block.screenStartPx
    if (region === undefined || widthPx <= 0) {
      continue
    }
    const halfBp = (radiusPx * (block.end - block.start)) / widthPx
    const cursorBp = bpAtPxExact(xPx, block)
    const bpMin = cursorBp - halfBp
    const bpMax = cursorBp + halfBp
    if (bpMax < block.start || bpMin > block.end) {
      continue
    }
    for (let m = marks.length - 1; m >= 0; m--) {
      if (!marks[m]!.spansView) {
        ask(m, block, region, { bpMin, bpMax })
      }
    }
  }
  return best
}

/** `[end - 1 .. start]`: every instance as candidates, back to front. */
export function backToFront(start: number, end: number): Iterable<number> {
  return new ReverseRange(start, end)
}

// A class rather than a generator: `for..of` steps this in a few ns where a
// generator yields in tens.
class ReverseRange implements Iterable<number>, Iterator<number> {
  private i: number
  private readonly start: number
  private readonly result = { value: 0, done: false }
  constructor(start: number, end: number) {
    this.start = start
    this.i = end
  }
  [Symbol.iterator]() {
    return this
  }
  next(): IteratorResult<number> {
    const r = this.result
    if (this.i > this.start) {
      this.i--
      r.value = this.i
      r.done = false
    } else {
      r.done = true
    }
    return r
  }
}

/**
 * A value-scaled shape's `valueWindow`, read back through `denormalizeScore`
 * inside each `rowHeight` band the radius touches — the whole canvas for a
 * shape with no rows. An end within reach of a band edge opens to infinity,
 * where an out-of-domain value clamps, so a cursor near the seam reaches the
 * neighbouring band too. A point passes its `insetPx`; a bar passes its
 * `origin`, and its window opens away from the origin on the cursor's side.
 */
export function valueWindow(
  yPx: number,
  radiusPx: number,
  { canvasHeight }: MarkFrame,
  scale: RowParams &
    MarkValueScale & {
      insetPx?: number
      origin?: number
    },
): [number, number] {
  const { domain, insetPx = 0, origin } = scale
  const { valueScaleType, valueSymlogConstant } = valueScaleUniforms(scale)
  const height = scale.rowHeight ?? canvasHeight
  const inset = Math.min(insetPx, height / 2)
  const bands = height > 0 ? Math.ceil(canvasHeight / height) : 1
  const bandAt = (y: number) =>
    bands > 1 ? Math.max(0, Math.min(bands - 1, Math.floor(y / height))) : 0
  const lastBand = bandAt(yPx + radiusPx)
  let valueMin = Infinity
  let valueMax = -Infinity
  for (let b = bandAt(yPx - radiusPx); b <= lastBand; b++) {
    const top = b * height
    const valueAt = (y: number) =>
      denormalizeScore(
        1 - (y - top - inset) / (height - 2 * inset),
        domain[0],
        domain[1],
        valueScaleType,
        valueSymlogConstant,
      )
    const lo =
      yPx + radiusPx >= top + height - inset
        ? -Infinity
        : valueAt(yPx + radiusPx)
    const hi =
      yPx - radiusPx <= top + inset ? Infinity : valueAt(yPx - radiusPx)
    const [bandMin, bandMax] =
      origin === undefined
        ? [lo, hi]
        : valueAt(yPx) >= origin
          ? [lo, Infinity]
          : [-Infinity, hi]
    valueMin = Math.min(valueMin, bandMin)
    valueMax = Math.max(valueMax, bandMax)
  }
  return [valueMin, valueMax]
}

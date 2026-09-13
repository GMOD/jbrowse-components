import { bpAtPxExact } from '../canvas2dUtils.ts'
import { denormalizeScore, scaleTypeCode } from '../scoreScale.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { Mark, MarkFrame, MarkHit, MarkValueScaleType } from './types.ts'

/** The bp a cursor's grab radius spans in one block. */
export interface HitWindow {
  block: RenderBlock
  bpMin: number
  bpMax: number
}

/** A {@link MarkHit}, with the mark, block and region it was found in. */
export interface NearestMarkHit<TRegion> extends MarkHit {
  mark: number
  block: RenderBlock
  region: TRegion
}

/**
 * The instance nearest `(xPx, yPx)` within `radiusPx`, over every block whose
 * column the radius reaches and whose region `regionOf` answers. Marks are
 * asked last to first, so on a tie the one painted on top wins; each mark's
 * `hitNearest` measures its own ink, and only a strictly nearer hit replaces
 * the best.
 *
 * `candidates` names the instances a mark is asked about in a block: what a
 * spatial index finds in the window, or every instance, back to front.
 * `undefined` leaves the mark out of that block.
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
  }: {
    radiusPx: number
    candidates: (
      region: TRegion,
      mark: number,
      window: HitWindow,
    ) => Iterable<number> | undefined
  },
): NearestMarkHit<TRegion> | undefined {
  let best: NearestMarkHit<TRegion> | undefined
  let bestDistSq = radiusPx * radiusPx
  for (const block of blocks) {
    const region = regionOf(block.displayedRegionIndex)
    const widthPx = block.screenEndPx - block.screenStartPx
    if (region === undefined || widthPx <= 0) {
      continue
    }
    const halfBp = (radiusPx * (block.end - block.start)) / widthPx
    const cursorBp = bpAtPxExact(xPx, block)
    const reach = { block, bpMin: cursorBp - halfBp, bpMax: cursorBp + halfBp }
    if (reach.bpMax < block.start || reach.bpMin > block.end) {
      continue
    }
    for (let m = marks.length - 1; m >= 0; m--) {
      const mark = marks[m]!
      if (!mark.hitNearest) {
        continue
      }
      const asked = candidates(region, m, reach)
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
  }
  return best
}

/**
 * The values an instance can hold and still put ink within `radiusPx` of
 * canvas y `yPx`: the query a spatial index over (bp, value) is asked with.
 * The scale is read back through `denormalizeScore`, and an end within reach
 * of a plot edge opens to infinity, where an out-of-domain value clamps.
 *
 * The anchor is the shape's: `insetPx` is a point's, and a bar passes its
 * `origin`, whose ink reaches from there to the value, so its window opens
 * away from the origin on the cursor's side.
 */
export function valueWindow(
  yPx: number,
  radiusPx: number,
  canvasHeight: number,
  scale: {
    domain: [number, number]
    scaleType?: MarkValueScaleType
    insetPx?: number
    origin?: number
  },
): [number, number] {
  const { domain, insetPx = 0, origin } = scale
  const code = scaleTypeCode(scale.scaleType)
  const inset = Math.min(insetPx, canvasHeight / 2)
  const valueAt = (y: number) =>
    denormalizeScore(
      1 - (y - inset) / (canvasHeight - 2 * inset),
      domain[0],
      domain[1],
      code,
    )
  const lo =
    yPx + radiusPx >= canvasHeight - inset ? -Infinity : valueAt(yPx + radiusPx)
  const hi = yPx - radiusPx <= inset ? Infinity : valueAt(yPx - radiusPx)
  if (origin === undefined) {
    return [lo, hi]
  }
  return valueAt(yPx) >= origin ? [lo, Infinity] : [-Infinity, hi]
}

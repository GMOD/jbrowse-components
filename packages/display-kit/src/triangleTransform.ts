import type { MarkContext2D } from '@jbrowse/render-core/marks'

/**
 * The contact-triangle map both triangle displays (Hi-C, LD) draw and hit-test
 * through: a cell's pre-rotation data coordinates (origin-relative bp / √2) are
 * rotated 45° into the triangle, then squashed by `yScalar`. The squash lands
 * after the rotation, so a squashed cell is a parallelogram.
 */
export interface TriangleTransform {
  /** viewport px per pre-rotation data unit */
  viewScale: number
  /** left edge of the drawn matrix, in canvas px */
  viewOffsetX: number
  yScalar: number
  /** canvas-px y where the triangle's base sits */
  yOffsetPx: number
}

export function triangleDataToScreen(
  ux: number,
  uy: number,
  { viewScale, viewOffsetX, yScalar, yOffsetPx }: TriangleTransform,
) {
  const rx = (ux + uy) * Math.SQRT1_2
  const ry = (uy - ux) * Math.SQRT1_2
  return {
    x: rx * viewScale + viewOffsetX,
    y: ry * viewScale * yScalar + yOffsetPx,
  }
}

/** The exact inverse of `triangleDataToScreen`. */
export function triangleScreenToData(
  x: number,
  y: number,
  { viewScale, viewOffsetX, yScalar, yOffsetPx }: TriangleTransform,
) {
  const rx = (x - viewOffsetX) / viewScale
  const ry = (y - yOffsetPx) / viewScale / yScalar
  return {
    x: (rx - ry) * Math.SQRT1_2,
    y: (rx + ry) * Math.SQRT1_2,
  }
}

/**
 * The live half of the map: pure view arithmetic, so pan and zoom move a
 * loaded payload with no refetch. The payload's axis origin folds back in here
 * in double precision, which keeps its float32 positions small.
 */
export function triangleViewTransform(
  host: { bpPerPx: number; offsetPx: number },
  data: { originBp: number } | null,
) {
  const { bpPerPx, offsetPx } = host
  const originBp = data ? data.originBp : 0
  return {
    viewScale: 1 / bpPerPx,
    viewOffsetX: originBp / bpPerPx - offsetPx,
  }
}

/**
 * The fit-to-height squash: the natural apex height is half the base, and a
 * squashed triangle stretches that into `displayHeight`. 1 for a zero-width
 * base.
 */
export function computeTriangleYScalar({
  squashToHeight,
  displayHeight,
  triangleWidth,
}: {
  squashToHeight: boolean
  displayHeight: number
  triangleWidth: number
}) {
  const triangleHeight = triangleWidth / 2
  return squashToHeight && triangleHeight > 0
    ? displayHeight / triangleHeight
    : 1
}

/** Where one fetched block sits on the view's concatenated genomic axis. */
export interface TriangleAxisBlock {
  /** the refName the view displays, before adapter renaming */
  refName: string
  /** bp of the block's leftmost-on-screen edge, relative to `originBp` */
  offsetBp: number
}

/**
 * Each block's position on the view's axis, which is the concatenation of
 * `displayedRegions` in display order. Elided regions keep their width, and
 * the boundary padding sits only outside the region run, so the axis is pure
 * cumulative bp and invariant under pan and zoom. A block in a reversed region
 * leads with its `end`.
 *
 * Offsets are relative to `originBp`, the first block's position: a whole
 * genome's axis overflows float32, one fetched window does not. `spanBp` runs
 * from the origin to the far edge of the last block.
 */
export function triangleAxis(
  blocks: {
    refName: string
    start: number
    end: number
    displayedRegionIndex?: number
  }[],
  displayedRegions: { start: number; end: number; reversed?: boolean }[],
) {
  const regionAxisStart: number[] = []
  let acc = 0
  for (const r of displayedRegions) {
    regionAxisStart.push(acc)
    acc += r.end - r.start
  }
  const absolute = blocks.map(b => {
    const idx = b.displayedRegionIndex!
    const d = displayedRegions[idx]!
    const lead = d.reversed ? d.end - b.end : b.start - d.start
    return regionAxisStart[idx]! + lead
  })
  const originBp = absolute[0] ?? 0
  const last = blocks.length - 1
  return {
    originBp,
    spanBp:
      last < 0
        ? 0
        : absolute[last]! + blocks[last]!.end - blocks[last]!.start - originBp,
    axisBlocks: blocks.map((b, i): TriangleAxisBlock => ({
      refName: b.refName,
      offsetBp: absolute[i]! - originBp,
    })),
  }
}

/**
 * Sets `ctx` up to paint cells as axis-aligned rects in pre-rotation space,
 * `ctx.fillRect(px * viewScale, py * viewScale, w * viewScale, h * viewScale)`,
 * and returns the visible range of `px + py`, which alone decides a point's
 * screen x. Adjacent rects share grid-aligned edges, so they tile without the
 * seams a per-cell diamond path leaves. The caller restores `ctx`.
 *
 * `viewScale` stays out of the ctx matrix: SvgCanvas rounds a serialized
 * transform to two decimals, and 1/bpPerPx rounds to zero past ~200 bp/px.
 */
export function enterTriangleCellSpace(
  ctx: MarkContext2D,
  {
    yScalar,
    viewScale,
    viewOffsetX,
  }: { yScalar: number; viewScale: number; viewOffsetX: number },
  width: number,
) {
  ctx.save()
  ctx.translate(viewOffsetX, 0)
  ctx.scale(1, yScalar)
  ctx.rotate(-Math.PI / 4)
  return {
    minSum: (-viewOffsetX / viewScale) * Math.SQRT2,
    maxSum: ((width - viewOffsetX) / viewScale) * Math.SQRT2,
  }
}

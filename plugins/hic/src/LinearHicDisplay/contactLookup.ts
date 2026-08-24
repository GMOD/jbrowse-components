import { mirrorU } from '../regionOffsets.ts'
import {
  getInstanceCount,
  getInstancePosition,
} from './components/shaders/hic.iface.generated.ts'

import type { RegionPairRun } from '../HicAdapter/HicAdapter.ts'
import type {
  HicContactItem,
  HicDataResult,
  HicResultRegion,
} from '../RenderHicDataRPC/types.ts'

/**
 * Uniform-grid index over the packed positions. `items` holds every contact
 * index grouped by the tile its cell's apex-ward corner lands in, and
 * `offsets[t]`..`offsets[t + 1]` is tile `t`'s slice of it.
 *
 * This replaced an open-addressed hash keyed on the recovered
 * `(regionPair, bin1, bin2)` tuple. The keys were the expensive part, not the
 * table: keying on bins meant inverting the worker's pack for all N contacts —
 * a reciprocal, a round and a reversed-region reflection per axis — purely so
 * that a *cursor* and a *stored cell* could be reduced to the same thing. A
 * tile does that directly off the position, which both already have, so the
 * build reads two floats and truncates two integers per contact and touches
 * neither the regions nor the run table.
 *
 * Measured over 4.5M contacts (`benches/contactTable.bench.ts`): 465ms for the
 * bin-recovering hash, 341ms once its run-invariant terms were hoisted out of
 * the inner loop, 84ms here — 3.1x at 300k, 5.6x at 4.5M. Memory falls with it:
 * 4 bytes per contact plus 2.3MB of counters, against the 6-12 bytes each a
 * 1.5x-capacity slot array rounded up to a power of two costs (20MB against
 * 32MB at that size).
 *
 * The build is what blocks a render, so that is the side worth buying. It is
 * not free on the other side — `probe` walks a tile neighbourhood where the
 * hash went to one slot — but that runs per mousemove against a build per
 * fetch. What it costs there is mostly a matter of which test screens the
 * neighbourhood: taking the cell rectangle before the run lookup and the bin
 * recovery is 0.36us at 4.5M against 1.15us for the other order, measured A/B
 * on one machine, and the hash's one-slot probe is 0.06us. See `probe`.
 *
 * What is indexed is cells, not points, so a cell straddling a tile boundary is
 * filed under the tile holding its min corner only and `probe` reads the 2x2
 * neighbourhood below-and-left of the cursor. Each axis's tile span floors at
 * `binWidth` to keep that neighbourhood sufficient: a cell then overlaps at
 * most two tiles per axis.
 */
interface ContactIndex {
  offsets: Uint32Array
  items: Uint32Array
  originX: number
  originY: number
  invSpanX: number
  invSpanY: number
  tilesX: number
  tilesY: number
}

// Tiles per axis, from the contact count rather than from how many bins the box
// covers: a whole-genome view at a fine binsize spans ~10^6 bins, and a grid
// sized off that would allocate more counters than there are contacts.
//
// A matrix fills its triangle, so ~half of `perAxis²` tiles are occupied and
// `sqrt(n/8)` holds an occupied one near 16 contacts at every size — a 2x2
// neighbourhood `probe` walks in a couple of microseconds — while the counter
// array stays at 2.25MB for the 4.5M case. The cap only binds somewhere past
// that.
function tilesPerAxis(numContacts: number) {
  return Math.min(2048, Math.max(1, Math.ceil(Math.sqrt(numContacts / 8))))
}

function buildContactIndex(data: HicDataResult): ContactIndex {
  const { numContacts, instances, binWidth } = data
  // Sized to the contacts' own bounding box, one axis at a time, rather than to
  // the regions' span. The two are far apart in the cases that matter: a
  // contact's x is `min(m1, m2)` and its y the max, so the triangle's x never
  // reaches the last region and its y never reaches the first, and an elided
  // region leaves a hole the axis still charges for. A grid stretched over
  // ground the data does not occupy is the failure mode this structure has —
  // every empty tile is capacity taken from an occupied one, and `probe` pays
  // for it on every mousemove.
  let loX = Infinity
  let hiX = -Infinity
  let loY = Infinity
  let hiY = -Infinity
  for (let i = 0; i < numContacts; i++) {
    const px = getInstancePosition(instances, i, 0)
    const py = getInstancePosition(instances, i, 1)
    loX = px < loX ? px : loX
    hiX = px > hiX ? px : hiX
    loY = py < loY ? py : loY
    hiY = py > hiY ? py : hiY
  }
  const originX = numContacts > 0 ? loX : 0
  const originY = numContacts > 0 ? loY : 0
  const perAxis = tilesPerAxis(numContacts)
  // Floored at `binWidth` so a cell overlaps at most two tiles per axis, which
  // is what makes `probe`'s 2x2 neighbourhood sufficient.
  const spanX = Math.max((hiX - loX) / perAxis, binWidth)
  const spanY = Math.max((hiY - loY) / perAxis, binWidth)
  const invSpanX = 1 / spanX
  const invSpanY = 1 / spanY
  // One tile of slack past the box so a corner sitting exactly on `hi` lands in
  // range. Nothing can land below 0: truncation takes a small negative to 0,
  // and no position is below its own axis minimum.
  const tilesX = numContacts > 0 ? Math.floor((hiX - loX) * invSpanX) + 2 : 1
  const tilesY = numContacts > 0 ? Math.floor((hiY - loY) * invSpanY) + 2 : 1
  const nTiles = tilesX * tilesY
  const offsets = new Uint32Array(nTiles + 1)
  for (let i = 0; i < numContacts; i++) {
    const tx = ((getInstancePosition(instances, i, 0) - originX) * invSpanX) | 0
    const ty = ((getInstancePosition(instances, i, 1) - originY) * invSpanY) | 0
    const t = ty * tilesX + tx + 1
    offsets[t] = offsets[t]! + 1
  }
  for (let t = 0; t < nTiles; t++) {
    offsets[t + 1] = offsets[t + 1]! + offsets[t]!
  }
  const cursor = offsets.slice(0, nTiles)
  const items = new Uint32Array(numContacts)
  for (let i = 0; i < numContacts; i++) {
    const tx = ((getInstancePosition(instances, i, 0) - originX) * invSpanX) | 0
    const ty = ((getInstancePosition(instances, i, 1) - originY) * invSpanY) | 0
    const t = ty * tilesX + tx
    items[cursor[t]!] = i
    cursor[t] = cursor[t]! + 1
  }
  return {
    offsets,
    items,
    originX,
    originY,
    invSpanX,
    invSpanY,
    tilesX,
    tilesY,
  }
}

// Built lazily from the worker's packed buffer and memoized against the result
// object. A WeakMap releases the index as soon as a new fetch replaces
// `rpcData`, and skips the build entirely when the user never hovers — which is
// also why it stays on the main thread rather than riding along with every RPC
// payload.
const lookupCache = new WeakMap<HicDataResult, ContactIndex>()

function getContactIndex(data: HicDataResult) {
  let index = lookupCache.get(data)
  if (!index) {
    index = buildContactIndex(data)
    lookupCache.set(data, index)
  }
  return index
}

/**
 * The run contact `i` belongs to. Relies on `pairRuns` tiling
 * `[0, numContacts)` in order, which `executeRenderHicData` guarantees by
 * construction — the adapter only emits a run for a pair that contributed at
 * least one contact, so a non-empty payload has a non-empty run table. The
 * index above no longer walks the runs to build itself, so this is where that
 * invariant is depended on.
 */
function runAt(pairRuns: RegionPairRun[], i: number) {
  let lo = 0
  let hi = pairRuns.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (pairRuns[mid]!.start <= i) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return pairRuns[lo]!
}

/**
 * The contact in the cursor's own cell, or undefined.
 *
 * The scan covers the cursor's tile and its neighbours one step down and left,
 * because a cell is filed under its min corner and can reach `binWidth` past
 * it. Bounds are clamped rather than guarded: a cursor left of or below the
 * grid gives an empty range and scans nothing.
 *
 * A candidate has to pass both its own cell rectangle and the bin comparison,
 * which is what the hash this replaced also required — there the key first and
 * the rectangle as the collision filter, here the other way round, because the
 * hash arrived at one slot and a tile hands over a neighbourhood. The rectangle
 * is four float compares off values already loaded and rejects all but the one
 * cell that can contain the point, so the run lookup and the bin recovery are
 * paid once rather than per candidate.
 *
 * Neither test is redundant. The rectangle alone is not enough because
 * `instances` is Float32Array: rounding a corner down by an ulp leaves a cell
 * overlapping its neighbour by that much, a seam ~1e-7 of a cell wide where the
 * wrong cell covers the point, and taking it would pair a score from one bin
 * with the loci `findContactAt` floored out of the cursor for the other. The
 * bins alone are not enough because a cell the float32 cast shrank can fail to
 * reach a cursor inside its exact bounds, which is a miss rather than a wrong
 * answer and stays one.
 *
 * The region pair is checked too, and by run rather than by asking which region
 * the candidate's coordinates fall in: the two disagree within a float32 ulp of
 * a region boundary, where a neighbour's rounded-down start still reads as
 * inside the region before it.
 *
 * Recovering a candidate's bins is the arithmetic the *build* used to do for
 * every contact in the payload; against the one candidate the rectangle admits
 * it costs nothing, and against the cursor's own regions it is exact once the
 * pair is known to match.
 */
function probe(
  data: HicDataResult,
  ux: number,
  uy: number,
  regionX: number,
  regionY: number,
  bin1: number,
  bin2: number,
) {
  const {
    offsets,
    items,
    originX,
    originY,
    invSpanX,
    invSpanY,
    tilesX,
    tilesY,
  } = getContactIndex(data)
  const { instances, binWidth, pairRuns, regions } = data
  const rx = regions[regionX]!
  const ry = regions[regionY]!
  const sameRegion = regionX === regionY
  const invBinWidth = 1 / binWidth
  const mirrorBaseX = rx.dataXStart + rx.dataXEnd - binWidth
  const mirrorBaseY = ry.dataXStart + ry.dataXEnd - binWidth
  const tx = ((ux - originX) * invSpanX) | 0
  const ty = ((uy - originY) * invSpanY) | 0
  const x0 = Math.max(0, Math.min(tx - 1, tilesX - 1))
  const x1 = Math.min(tx, tilesX - 1)
  const y0 = Math.max(0, Math.min(ty - 1, tilesY - 1))
  const y1 = Math.min(ty, tilesY - 1)
  for (let gy = y0; gy <= y1; gy++) {
    const row = gy * tilesX
    for (let gx = x0; gx <= x1; gx++) {
      const t = row + gx
      const end = offsets[t + 1]!
      for (let k = offsets[t]!; k < end; k++) {
        const i = items[k]!
        const px = getInstancePosition(instances, i, 0)
        const py = getInstancePosition(instances, i, 1)
        if (ux >= px && ux < px + binWidth && uy >= py && uy < py + binWidth) {
          const run = runAt(pairRuns, i)
          const a = Math.round(
            (rx.reversed ? mirrorBaseX - px : px) * invBinWidth -
              rx.combinedOffset,
          )
          const b = Math.round(
            (ry.reversed ? mirrorBaseY - py : py) * invBinWidth -
              ry.combinedOffset,
          )
          const swap = sameRegion && a > b
          if (
            run.region1Idx === regionX &&
            run.region2Idx === regionY &&
            (swap ? b : a) === bin1 &&
            (swap ? a : b) === bin2
          ) {
            return i
          }
        }
      }
    }
  }
  return undefined
}

/**
 * Bucket a pre-rotation data-x coordinate into a region index. Returns the last
 * region whose `dataXStart` is ≤ `u`, clamping to region 0 for coordinates left
 * of the first region — so a cursor in a gap between two regions (an elided
 * region, or padding) reads as the region on its left, which is what the probe
 * below then fails to match on, yielding no contact.
 */
function findRegion(regions: HicResultRegion[], u: number) {
  for (let i = regions.length - 1; i > 0; i--) {
    if (u >= regions[i]!.dataXStart) {
      return i
    }
  }
  return 0
}

/**
 * Given pre-rotation data-space coords (`ux`, `uy` — the same space the packed
 * positions live in), return the contact bin under the cursor or undefined.
 * Inverts `position = (bin + combinedOffset) * binWidth` exactly the way the
 * worker built it, so a hover always matches what was drawn.
 */
export function findContactAt(
  data: HicDataResult,
  ux: number,
  uy: number,
): HicContactItem | undefined {
  const { binWidth, regions, instances } = data
  if (regions.length === 0) {
    return undefined
  }
  // Bucketing needs no un-mirroring first: a reversed region reflects onto its
  // own span, so the cursor already sits in the right region either way.
  const regionX = findRegion(regions, ux)
  const regionY = findRegion(regions, uy)
  const rx = regions[regionX]!
  const ry = regions[regionY]!
  // Undo the reflection the worker baked into the packed positions (it is its
  // own inverse) to land back in the forward space the bin math assumes.
  const fx = rx.reversed ? mirrorU(rx, ux) : ux
  const fy = ry.reversed ? mirrorU(ry, uy) : uy
  const binX = Math.floor(fx / binWidth - rx.combinedOffset)
  const binY = Math.floor(fy / binWidth - ry.combinedOffset)
  // The index stores contacts as the adapter emitted them (region1Idx ≤
  // region2Idx, and bin1 ≤ bin2 within a region), but reflecting a region
  // reverses which endpoint the worker put on the x axis. Restore that order
  // before keying. Regions can't invert (each endpoint stays in its own, and
  // ux ≤ uy below the apex), so only a same-region pair can need the swap.
  const swap = regionX === regionY && binX > binY
  const [bin1, bin2] = swap ? [binY, binX] : [binX, binY]
  const idx = probe(data, ux, uy, regionX, regionY, bin1, bin2)
  return idx === undefined
    ? undefined
    : {
        bin1,
        bin2,
        region1Idx: regionX,
        region2Idx: regionY,
        counts: getInstanceCount(instances, idx),
      }
}

import { mirrorU } from '../regionOffsets.ts'
import {
  getInstanceCount,
  getInstancePosition,
} from './components/shaders/hic.iface.generated.ts'

import type {
  HicContactItem,
  HicDataResult,
  HicResultRegion,
  RegionPairRun,
} from '../RenderHicDataRPC/types.ts'

/**
 * Uniform-grid index over the packed positions: `items` holds contact indices
 * grouped by the tile their cell's min corner lands in, `offsets[t]` to
 * `offsets[t + 1]` being tile `t`'s slice. Building off positions, rather than
 * recovering every contact's bins, measured 84ms against 341ms at 4.5M
 * contacts (`benches/contactTable.bench.ts`).
 *
 * A tile spans at least `binWidth`, so a cell overlaps at most two tiles per
 * axis and `probe`'s 2x2 neighbourhood is enough.
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

// From the contact count, not the bins covered: a whole genome at a fine
// binsize spans ~10^6 bins. A matrix fills half its box, so sqrt(n/8) puts
// about 16 contacts in an occupied tile.
function tilesPerAxis(numContacts: number) {
  return Math.min(2048, Math.max(1, Math.ceil(Math.sqrt(numContacts / 8))))
}

function buildContactIndex(data: HicDataResult): ContactIndex {
  const { numContacts, instances, binWidth } = data
  // Sized to the contacts' own box: a triangle leaves half the regions' box
  // empty, and every empty tile costs `probe` on each mousemove.
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
  const spanX = Math.max((hiX - loX) / perAxis, binWidth)
  const spanY = Math.max((hiY - loY) / perAxis, binWidth)
  const invSpanX = 1 / spanX
  const invSpanY = 1 / spanY
  // one tile of slack so a corner exactly on `hi` lands in range
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

// Built on the first hover of a payload, released with it.
const lookupCache = new WeakMap<HicDataResult, ContactIndex>()

function getContactIndex(data: HicDataResult) {
  let index = lookupCache.get(data)
  if (!index) {
    index = buildContactIndex(data)
    lookupCache.set(data, index)
  }
  return index
}

/** The run contact `i` belongs to; the runs tile `[0, numContacts)`. */
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
 * The contact in the cursor's own cell. A cell is filed under its min corner,
 * so the scan covers the cursor's tile and the ones below and left of it.
 *
 * A candidate must pass its cell rectangle, its region pair and its bins. The
 * rectangle alone is not enough: a float32 corner rounded down overlaps its
 * neighbour by an ulp, and the pair is checked by run because coordinates
 * disagree with the run within an ulp of a region boundary. The rectangle
 * runs first, so the rest is paid once.
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
 * The last region starting at or before `u`, else region 0. A cursor in a gap
 * reads as the region on its left, where `probe` then finds nothing.
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
 * The contact at pre-rotation point (`ux`, `uy`), inverting
 * `position = (bin + combinedOffset) * binWidth` as the worker built it.
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
  const regionX = findRegion(regions, ux)
  const regionY = findRegion(regions, uy)
  const rx = regions[regionX]!
  const ry = regions[regionY]!
  const fx = rx.reversed ? mirrorU(rx, ux) : ux
  const fy = ry.reversed ? mirrorU(ry, uy) : uy
  const binX = Math.floor(fx / binWidth - rx.combinedOffset)
  const binY = Math.floor(fy / binWidth - ry.combinedOffset)
  // A reflection reverses which endpoint lands on x inside one region
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

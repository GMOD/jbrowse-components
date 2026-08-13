import { mirrorU } from '../regionOffsets.ts'
import {
  getInstanceCount,
  getInstancePosition,
} from './components/shaders/hic.iface.generated.ts'

import type {
  HicContactItem,
  HicDataResult,
  HicResultRegion,
} from '../RenderHicDataRPC/types.ts'

/**
 * Scatter a grid cell across the table. Deliberately NOT injective: `probe`
 * re-checks the candidate geometrically, so a collision only costs a step. That
 * is what makes this safe where packing the tuple into one number is not — bins
 * are absolute chromosome indices (~10^6 at fine binsizes), so a `bin1 * K +
 * bin2` key needs ~2^52 and stops being an exact integer.
 */
function hashCell(r1: number, r2: number, bin1: number, bin2: number) {
  return (
    Math.imul(bin1, 0x9e3779b1) ^
    Math.imul(bin2, 0x85ebca6b) ^
    Math.imul(r1 * 256 + r2, 0xc2b2ae35)
  )
}

/**
 * Recover a contact's bin index on one axis from the position the worker packed.
 *
 * The worker wrote `(bin + combinedOffset) * binWidth`, mirrored within the
 * region if that region is reversed. Both steps invert exactly, which is why
 * the payload no longer carries per-contact bin columns
 * (see {@link HicDataResult.pairRuns}): `combinedOffset` cancels the
 * chromosome-absolute part *before* the float32 cast, so the stored value is a
 * small on-screen coordinate and `binRecovery.test.ts` measures the worst
 * round-trip error at 1.4e-3 bins.
 *
 * The `- binWidth` in the reversed branch is not a fudge: `mirrorU` reflects a
 * point, and reflecting a cell's apex-ward corner lands on its far corner, one
 * cell width along. The forward mirror folded that into `mirrorBase`
 * (`executeRenderHicData`); this unfolds it.
 */
function binAt(
  data: HicDataResult,
  i: number,
  regionIdx: number,
  axis: number,
) {
  const { instances, regions, binWidth } = data
  const region = regions[regionIdx]!
  const m = getInstancePosition(instances, i, axis)
  const u = region.reversed ? mirrorU(region, m) - binWidth : m
  return Math.round(u / binWidth - region.combinedOffset)
}

/**
 * Open-addressed cell → contact-index table over a single `Uint32Array`. Slots
 * hold `contactIndex + 1`, so 0 reads as empty.
 *
 * This replaced a `Map<string, number>` keyed by `${r1}|${r2}|${bin1}|${bin2}`.
 * That allocated one string per contact, and contact counts are large — the
 * auto binsize targets ~0.5 bins per screen pixel, so a full-width triangle is
 * ~(width/2)^2/2 ≈ 300k contacts, and each step of `resolutionBias` toward finer
 * multiplies that by ~4 (two steps ≈ 4.5M). Measured build cost for the string
 * map was ~515ms at 300k and ~8.7s at 4.5M, paid as a freeze on the first mouse
 * move over the track; the typed table is ~25x faster (~20ms / ~350ms) and uses
 * less memory (one 1.5x-sized Uint32Array vs a Map of N strings).
 */
interface ContactTable {
  slots: Uint32Array
  mask: number
}

// 1.5x capacity, rounded up to a power of two so `& mask` replaces a modulo.
// Measured no faster at 2x, and this halves the allocation.
//
// Capacity strictly greater than `numContacts` is what terminates both loops
// below: at least one slot is always empty, so a full-table walk can't spin. It
// holds for an empty result too (capacity floors at 1).
function buildContactTable(data: HicDataResult): ContactTable {
  const { numContacts, pairRuns } = data
  let capacity = 1
  while (capacity < numContacts * 1.5) {
    capacity *= 2
  }
  const slots = new Uint32Array(capacity)
  const mask = capacity - 1
  // Iterating the runs rather than `[0, numContacts)` is what gives each
  // contact its region pair — read once per run, and needed here because the
  // bins are recovered against the region's own offset and orientation.
  for (const { region1Idx, region2Idx, start, end } of pairRuns) {
    const sameRegion = region1Idx === region2Idx
    for (let i = start; i < end; i++) {
      const a = binAt(data, i, region1Idx, 0)
      const b = binAt(data, i, region2Idx, 1)
      // Canonicalize exactly as `findContactAt` does before probing: mirroring
      // a region reverses which endpoint the worker put on the x axis, so a
      // same-region pair can arrive with the larger bin first. Cross-region
      // pairs can't invert (each endpoint stays in its own region).
      const bin1 = sameRegion && a > b ? b : a
      const bin2 = sameRegion && a > b ? a : b
      let h = hashCell(region1Idx, region2Idx, bin1, bin2) & mask
      while (slots[h] !== 0) {
        h = (h + 1) & mask
      }
      slots[h] = i + 1
    }
  }
  return { slots, mask }
}

// Built lazily from the worker's packed buffer and memoized against the result
// object. A WeakMap releases the table as soon as a new fetch replaces
// `rpcData`, and skips the build entirely when the user never hovers — which is
// also why the table stays on the main thread rather than riding along with
// every RPC payload.
const lookupCache = new WeakMap<HicDataResult, ContactTable>()

function getContactTable(data: HicDataResult) {
  let table = lookupCache.get(data)
  if (!table) {
    table = buildContactTable(data)
    lookupCache.set(data, table)
  }
  return table
}

/**
 * The contact whose cell contains `(ux, uy)`, or undefined.
 *
 * A candidate is confirmed against its own packed cell rectangle rather than
 * against a recovered bin pair, which is both cheaper and more direct: cells
 * tile data space, so at most one contact's cell can hold a given point, and
 * the test needs neither the candidate's region nor a second bin recovery. The
 * hash still keys on bins because that is the only thing a *cursor* and a
 * *stored cell* can both be reduced to — the cursor has no index of its own.
 */
function probe(
  data: HicDataResult,
  r1: number,
  r2: number,
  bin1: number,
  bin2: number,
  ux: number,
  uy: number,
) {
  const { slots, mask } = getContactTable(data)
  const { instances, binWidth } = data
  let h = hashCell(r1, r2, bin1, bin2) & mask
  let slot = slots[h]!
  while (slot !== 0) {
    const i = slot - 1
    const px = getInstancePosition(instances, i, 0)
    const py = getInstancePosition(instances, i, 1)
    if (ux >= px && ux < px + binWidth && uy >= py && uy < py + binWidth) {
      return i
    }
    h = (h + 1) & mask
    slot = slots[h]!
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
  const idx = probe(data, regionX, regionY, bin1, bin2, ux, uy)
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

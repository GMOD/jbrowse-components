import { mirrorUInRegion } from '../regionOffsets.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../RenderHicDataRPC/types.ts'

/**
 * Scatter a grid cell across the table. Deliberately NOT injective: `probe`
 * re-compares all four coordinate arrays, so a collision only costs a step. That
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
  const {
    numContacts,
    contactBin1,
    contactBin2,
    contactRegion1,
    contactRegion2,
  } = data
  let capacity = 1
  while (capacity < numContacts * 1.5) {
    capacity *= 2
  }
  const slots = new Uint32Array(capacity)
  const mask = capacity - 1
  for (let i = 0; i < numContacts; i++) {
    let h =
      hashCell(
        contactRegion1[i]!,
        contactRegion2[i]!,
        contactBin1[i]!,
        contactBin2[i]!,
      ) & mask
    while (slots[h] !== 0) {
      h = (h + 1) & mask
    }
    slots[h] = i + 1
  }
  return { slots, mask }
}

// Built lazily from the worker's per-contact arrays and memoized against the
// result object. A WeakMap releases the table as soon as a new fetch replaces
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

function probe(
  data: HicDataResult,
  r1: number,
  r2: number,
  bin1: number,
  bin2: number,
) {
  const { slots, mask } = getContactTable(data)
  const { contactBin1, contactBin2, contactRegion1, contactRegion2 } = data
  let h = hashCell(r1, r2, bin1, bin2) & mask
  let slot = slots[h]!
  while (slot !== 0) {
    const i = slot - 1
    if (
      contactBin1[i] === bin1 &&
      contactBin2[i] === bin2 &&
      contactRegion1[i] === r1 &&
      contactRegion2[i] === r2
    ) {
      return i
    }
    h = (h + 1) & mask
    slot = slots[h]!
  }
  return undefined
}

/**
 * Bucket a pre-rotation data-x coordinate into a region index against
 * `regionDataXBounds` (`[start0, end0, start1, end1, …]`). Returns the last
 * region whose start is ≤ `u`, clamping to region 0 for coordinates left of the
 * first region — so a cursor in a gap between two regions (an elided region, or
 * padding) reads as the region on its left, which is what the probe below then
 * fails to match on, yielding no contact.
 */
function findRegion(bounds: number[], u: number) {
  for (let i = bounds.length / 2 - 1; i >= 0; i--) {
    if (u >= bounds[i * 2]!) {
      return i
    }
  }
  return 0
}

/**
 * Given pre-rotation data-space coords (`ux`, `uy` — the same space
 * `positions[]` live in), return the contact bin under the cursor or undefined.
 * Inverts `positions[i] = (bin + regionCombinedOffsets[r]) * binWidth` exactly
 * the way the worker built it, so a hover always matches what was drawn.
 */
export function findContactAt(
  data: HicDataResult,
  ux: number,
  uy: number,
): HicContactItem | undefined {
  const {
    binWidth,
    regionDataXBounds,
    regionCombinedOffsets,
    regionReversed,
    counts,
  } = data
  // Bucketing needs no un-mirroring first: a reversed region reflects onto its
  // own span, so the cursor already sits in the right region either way.
  const regionX = findRegion(regionDataXBounds, ux)
  const regionY = findRegion(regionDataXBounds, uy)
  // Undo the reflection the worker baked into positions[] (it is its own
  // inverse) to land back in the forward space the bin math assumes.
  const fx = regionReversed[regionX]
    ? mirrorUInRegion(regionDataXBounds, regionX, ux)
    : ux
  const fy = regionReversed[regionY]
    ? mirrorUInRegion(regionDataXBounds, regionY, uy)
    : uy
  const binX = Math.floor(fx / binWidth - regionCombinedOffsets[regionX]!)
  const binY = Math.floor(fy / binWidth - regionCombinedOffsets[regionY]!)
  // The index stores contacts as the adapter emitted them (region1Idx ≤
  // region2Idx, and bin1 ≤ bin2 within a region), but reflecting a region
  // reverses which endpoint the worker put on the x axis. Restore that order
  // before keying. Regions can't invert (each endpoint stays in its own, and
  // ux ≤ uy below the apex), so only a same-region pair can need the swap.
  const swap = regionX === regionY && binX > binY
  const [bin1, bin2] = swap ? [binY, binX] : [binX, binY]
  const idx = probe(data, regionX, regionY, bin1, bin2)
  return idx === undefined
    ? undefined
    : {
        bin1,
        bin2,
        region1Idx: regionX,
        region2Idx: regionY,
        counts: counts[idx]!,
      }
}

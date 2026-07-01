import type { HicContactItem, HicDataResult } from '../RenderHicDataRPC/types.ts'

/**
 * Grid-cell key for the hover index: `${r1}|${r2}|${bin1}|${bin2}`. Built on the
 * main thread only — the worker ships compact per-contact typed arrays instead
 * of a string-keyed Record, so this key format never crosses the worker
 * boundary.
 */
function contactLookupKey(r1: number, r2: number, bin1: number, bin2: number) {
  return `${r1}|${r2}|${bin1}|${bin2}`
}

// Cell → contact-index map, rebuilt lazily from the worker's per-contact arrays
// and memoized against the result object. A WeakMap releases the map as soon as
// a new fetch replaces `rpcData`, and skips the build entirely when the user
// never hovers.
const lookupCache = new WeakMap<HicDataResult, Map<string, number>>()

function getContactLookup(data: HicDataResult) {
  const cached = lookupCache.get(data)
  if (cached) {
    return cached
  }
  const { numContacts, contactBin1, contactBin2, contactRegion1, contactRegion2 } =
    data
  const map = new Map<string, number>()
  for (let i = 0; i < numContacts; i++) {
    map.set(
      contactLookupKey(
        contactRegion1[i]!,
        contactRegion2[i]!,
        contactBin1[i]!,
        contactBin2[i]!,
      ),
      i,
    )
  }
  lookupCache.set(data, map)
  return map
}

/**
 * Bucket a pre-rotation data-x coordinate into a region index against
 * `regionDataXStarts` (length regions.length+1; index r is the start of region
 * r). Returns the last region whose start is ≤ `u`, clamping to region 0 for
 * coordinates left of the first region.
 */
function findRegion(starts: number[], u: number) {
  for (let i = starts.length - 2; i >= 0; i--) {
    if (u >= starts[i]!) {
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
  const { binWidth, regionDataXStarts, regionCombinedOffsets, counts } = data
  const r1 = findRegion(regionDataXStarts, ux)
  const r2 = findRegion(regionDataXStarts, uy)
  const bin1 = Math.floor(ux / binWidth - regionCombinedOffsets[r1]!)
  const bin2 = Math.floor(uy / binWidth - regionCombinedOffsets[r2]!)
  const idx = getContactLookup(data).get(contactLookupKey(r1, r2, bin1, bin2))
  return idx === undefined
    ? undefined
    : {
        bin1,
        bin2,
        region1Idx: r1,
        region2Idx: r2,
        counts: counts[idx]!,
      }
}

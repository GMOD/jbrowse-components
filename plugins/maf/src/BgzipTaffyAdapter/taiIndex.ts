import VirtualOffset from './virtualOffset.ts'

import type { ByteRange, IndexData } from './types.ts'

// bgzf blocks are at most 64KiB of uncompressed data; a raw virtual offset
// packs (block << 16) | dataPosition.
const BGZF_BLOCK_SIZE = 65536

/**
 * Parse a `.tai` Taffy index into per-chromosome byte-range entries.
 *
 * Each row is tab-separated `chr  chrStart  virtualOffset`. A `*` in the chr
 * column marks a *relative* row whose chrStart/virtualOffset are deltas added
 * to the running absolute values of the previous row (mirrors taffy's tai
 * writer). The absolute virtual offset is split into a bgzf (block, data)
 * coordinate.
 */
export function parseTaiIndex(text: string): IndexData {
  const lines = text
    .split('\n')
    .map(f => f.trim())
    .filter(line => line !== '')
  const entries: IndexData = {}
  let lastChr = ''
  let lastChrStart = 0
  let lastRawVirtualOffset = 0

  for (const line of lines) {
    const [chr, chrStart, virtualOffset] = line.split('\t')
    const isRelative = chr === '*'
    const currChr = isRelative ? lastChr : chr!.split('.').at(-1)!

    const absVirtualOffset = isRelative
      ? lastRawVirtualOffset + +virtualOffset!
      : +virtualOffset!
    const absChrStart = isRelative ? lastChrStart + +chrStart! : +chrStart!

    const blockPosition = Math.floor(absVirtualOffset / BGZF_BLOCK_SIZE)
    const dataPosition = absVirtualOffset % BGZF_BLOCK_SIZE
    const voff = new VirtualOffset(blockPosition, dataPosition)

    entries[currChr] ??= []
    entries[currChr].push({
      chrStart: absChrStart,
      virtualOffset: voff,
    })
    lastChr = currChr
    lastChrStart = absChrStart
    lastRawVirtualOffset = absVirtualOffset
  }
  return entries
}

/**
 * Binary search to find the index of the first element >= target
 */
export function lowerBound<T>(
  arr: T[],
  target: number,
  getKey: (item: T) => number,
) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (getKey(arr[mid]!) < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * Pick the index entries bracketing a query `[queryStart, queryEnd)`.
 *
 * The `.tai` index is sparse, so the entry containing `queryStart` is the one
 * *before* the first entry whose `chrStart >= queryStart` (clamped to 0).
 * `nextEntry` reaches one entry past `queryEnd` as a read cushion, falling back
 * to the last entry when the query runs off the end of the index. Reading a
 * little extra is harmless; reading too little would truncate the region.
 */
export function selectIndexEntries(
  records: ByteRange[],
  queryStart: number,
  queryEnd: number,
): { firstEntry: ByteRange | undefined; nextEntry: ByteRange | undefined } {
  const getKey = (r: ByteRange) => r.chrStart
  const startIdx = lowerBound(records, queryStart, getKey)
  const endIdx = lowerBound(records, queryEnd, getKey)
  return {
    firstEntry: records[Math.max(startIdx - 1, 0)],
    nextEntry: records[endIdx + 1] ?? records.at(-1),
  }
}

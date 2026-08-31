import { parseAssemblyAndChr } from '../util/parseAssemblyName.ts'

import type { ByteRange, IndexData } from './types.ts'

// bgzf blocks are at most 64KiB of uncompressed data; a raw virtual offset
// packs (block << 16) | dataPosition.
const BGZF_BLOCK_SIZE = 65536

/**
 * The chromosome named by a `.tai` source token (`assembly.chr`, or
 * `assembly.version.chr` for a haplotype genome like `Species1.1.chr3`), split
 * by the same `parseAssemblyAndChr` the MAF-tabix and bigMaf paths use. A bare
 * token with no assembly prefix is the chromosome itself.
 *
 * Taking the last dotted segment — which this replaces — mangled any chromosome
 * whose own name contains a dot: `hg38.GL000009.2` keyed as `2`, so
 * `getRefNames` advertised a name no region ever queries, and every dotted
 * accession sharing a suffix collapsed into one key whose entries then
 * interleave two chromosomes' offsets and break `selectIndexEntries`' ascending
 * binary search.
 */
export function chrFromSourceName(name: string) {
  const { assemblyName, chr } = parseAssemblyAndChr(name)
  return chr === '' ? assemblyName : chr
}

/**
 * Whether a block's reference source token names `refName` — the chromosome
 * filter both bgzip adapters apply to what they decode. The read is
 * deliberately generous (`queryBlockSpan` bounds past-the-end at the *next*
 * chromosome's first block, plus a 64KB cushion), and coordinates restart per
 * chromosome, so filtering on numeric overlap alone put the next chromosome's
 * blocks at real positions on the queried scaffold.
 *
 * Compared through `chrFromSourceName`, which is how the `.tai` keys
 * `getRefNames` advertises are built, so both sides are in one namespace.
 * Memoized like `makeSourceResolver`: one source token, tens of thousands of
 * blocks.
 */
export function makeRefChrFilter(refName: string) {
  const answers = new Map<string, boolean>()
  return (sourceName: string) => {
    let onChr = answers.get(sourceName)
    if (onChr === undefined) {
      onChr = chrFromSourceName(sourceName) === refName
      answers.set(sourceName, onChr)
    }
    return onChr
  }
}

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
  const entries: IndexData = new Map()
  let lastChr = ''
  let lastChrStart = 0
  let lastRawVirtualOffset = 0

  for (const line of lines) {
    const [chr, chrStart, virtualOffset] = line.split('\t')
    const isRelative = chr === '*'
    const currChr = isRelative ? lastChr : chrFromSourceName(chr!)

    const absVirtualOffset = isRelative
      ? lastRawVirtualOffset + +virtualOffset!
      : +virtualOffset!
    const absChrStart = isRelative ? lastChrStart + +chrStart! : +chrStart!

    const blockPosition = Math.floor(absVirtualOffset / BGZF_BLOCK_SIZE)
    const dataPosition = absVirtualOffset % BGZF_BLOCK_SIZE

    let chrEntries = entries.get(currChr)
    if (chrEntries === undefined) {
      chrEntries = []
      entries.set(currChr, chrEntries)
    }
    chrEntries.push({
      chrStart: absChrStart,
      virtualOffset: { blockPosition, dataPosition },
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
 *
 * `ranPastEnd` is true when there is no real cushion entry past `queryEnd` (the
 * query reaches the last index entry of the chromosome). taffy spaces entries
 * by genomic distance and gives no guarantee the last entry is near the end of
 * the chromosome's data, so the caller must bound the read at the chromosome's
 * data end rather than trusting the fallback entry's offset (see
 * `chrDataEndOffset`).
 */
export function selectIndexEntries(
  records: ByteRange[],
  queryStart: number,
  queryEnd: number,
): {
  firstEntry: ByteRange | undefined
  nextEntry: ByteRange | undefined
  ranPastEnd: boolean
} {
  const getKey = (r: ByteRange) => r.chrStart
  const startIdx = lowerBound(records, queryStart, getKey)
  const endIdx = lowerBound(records, queryEnd, getKey)
  const cushion = records[endIdx + 1]
  return {
    firstEntry: records[Math.max(startIdx - 1, 0)],
    nextEntry: cushion ?? records.at(-1),
    ranPastEnd: cushion === undefined,
  }
}

/**
 * Compressed byte offset where the chromosome after `refName` begins, i.e. where
 * `refName`'s data ends — `undefined` if `refName` is the last chromosome. TAF
 * and MAF are sorted by reference position so each chromosome's blocks are
 * contiguous, and the index preserves that file order. Used to bound a read that
 * runs past a chromosome's last sparse index entry without needing the file
 * size.
 *
 * File order is the whole point, which is why `IndexData` is a `Map` — see its
 * own comment for what an object's integer-like key ordering did to this.
 */
export function nextChrStartBlock(index: IndexData, refName: string) {
  let seenRefName = false
  let next: ByteRange[] | undefined
  for (const [chr, entries] of index) {
    if (seenRefName) {
      next = entries
      break
    }
    seenRefName = chr === refName
  }
  return next?.[0]?.virtualOffset.blockPosition
}

/** The index entries and compressed block span one region query resolves to. */
export interface QueryBlockSpan {
  firstEntry: ByteRange
  nextEntry: ByteRange | undefined
  ranPastEnd: boolean
  /** compressed byte offset of the bgzf block the read starts in */
  startBlock: number
  /** compressed byte offset the read is bounded at (== startBlock for a
   * single-block read; `readLength` adds the one-block cushion) */
  endBlock: number
  /**
   * Compressed bytes a read of this span actually pulls, cushion included —
   * what `getFeatures` passes to `file.read` and what `getRegionByteSize`
   * reports to the fetch gate.
   *
   * The cushion is not slack to be dropped from the estimate: the bounding
   * entry names the bgzf block the next bracket *starts* in, so the block
   * itself still has to be read whole, and `endBlock === startBlock` (a query
   * inside one bracket, or one running past a chromosome's last sparse entry)
   * makes the span zero-width while the read is a full block. Reporting the
   * span alone told the gate a real 64KB download was free.
   */
  readLength: number
}

/**
 * Minimum compressed bytes to read for any span. A bgzf block holds at most
 * 64KiB *uncompressed*, so one block is always covered — and the block the span
 * ends in has to be read whole to decode the entries inside it.
 */
const MIN_BLOCK_SIZE = 65536

/**
 * Resolve a `[queryStart, queryEnd)` region on `refName` to the bgzf block span
 * a read of it covers. Undefined when the chromosome isn't in the index.
 *
 * The single source for both the read in `getFeatures` and the byte estimate in
 * `getRegionByteSize` — hence `readLength` rather than each caller deriving its
 * own from `startBlock`/`endBlock`. They already disagreed twice: the estimate
 * once measured to the fallback entry and skipped the past-the-end chromosome
 * bound, and it then went on reporting the raw span while the read added a
 * one-block cushion, so both a narrow query inside a single bracket and one
 * running past a chromosome's last sparse entry estimated 0 bytes for a real
 * 64KB download. That is exactly the case the fetch gate exists to catch.
 */
export function queryBlockSpan(
  index: IndexData,
  refName: string,
  queryStart: number,
  queryEnd: number,
): QueryBlockSpan | undefined {
  const records = index.get(refName)
  const selected = records?.length
    ? selectIndexEntries(records, queryStart, queryEnd)
    : undefined
  const firstEntry = selected?.firstEntry
  let span: QueryBlockSpan | undefined
  if (selected !== undefined && firstEntry !== undefined) {
    const { nextEntry, ranPastEnd } = selected
    const startBlock = firstEntry.virtualOffset.blockPosition
    // With no cushion entry past the query, taffy gives no guarantee the last
    // index entry is near the chromosome's data end — so bound at the next
    // chromosome's first block rather than that entry, which would truncate a
    // final bracket larger than one bgzf block. The last chromosome has no next
    // block to bound against (and reading the file size needs a CORS-exposed
    // Content-Range), so it falls back to the caller's one-block cushion.
    const endBlock = ranPastEnd
      ? (nextChrStartBlock(index, refName) ?? startBlock)
      : (nextEntry?.virtualOffset.blockPosition ?? startBlock)
    span = {
      firstEntry,
      nextEntry,
      ranPastEnd,
      startBlock,
      endBlock,
      readLength:
        endBlock > startBlock
          ? endBlock - startBlock + MIN_BLOCK_SIZE
          : MIN_BLOCK_SIZE,
    }
  }
  return span
}

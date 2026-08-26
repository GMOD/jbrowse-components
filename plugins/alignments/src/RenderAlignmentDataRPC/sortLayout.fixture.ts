import { GAP_SKIP } from '../shaders/slang/gap.consts.generated.ts'
import { namesToBlock } from '../shared/readNameBlock.ts'
import { INTERBASE_SOFTCLIP } from '../shared/types.ts'
import { baseWorkerPileupData } from './testPileupData.ts'

import type { WorkerPileupData } from './types.ts'

// Synthetic WorkerPileupData builder for layout tests. Shared rather than
// duplicated so the R-export equivalence test drives JBrowse's real
// computeSortedLayout over the exact same reads it hands to the R helper.
export interface Read {
  start: number
  end: number
  // Stable identity, so a test can present the same reads in a different array
  // order and still compare per-read results. Defaults to the slot index.
  id?: string
  baseAtSortPos?: string
  tagValue?: string
  strand?: number
  // An interbase mark at genomic `pos` of `length` bp — a soft clip unless
  // `type` says otherwise (left clip when pos <= start). Only soft clips expand
  // a read's layout extent; the other kinds exist here to be sorted on.
  softclip?: { pos: number; length: number; type?: number }
  // Intron skips, [start, end) each — what marks the read as spliced.
  skips?: [number, number][]
}

export function makePileupData(opts: {
  regionStart: number
  reads: Read[]
  sortPos?: number
  // Distinguishes reads across regions in multi-region tests; the same prefix+i
  // in two regions is treated as one boundary-spanning read (dedup by id).
  idPrefix?: string
}): WorkerPileupData {
  const { reads, sortPos, idPrefix = 'id' } = opts
  const numReads = reads.length
  const hasAnyTagValue = reads.some(r => r.tagValue !== undefined)
  const sortTagValues = hasAnyTagValue
    ? reads.map(r => r.tagValue ?? '')
    : undefined

  const readPositions = new Uint32Array(numReads * 2)
  const readKeys: string[] = []
  const readNames: string[] = []
  for (const [i, r] of reads.entries()) {
    readPositions[i * 2] = r.start
    readPositions[i * 2 + 1] = r.end
    readKeys.push(r.id ?? `${idPrefix}${i}`)
    readNames.push(r.id ?? `${idPrefix}${i}`)
  }

  const mismatchEntries: { readIdx: number; pos: number; base: number }[] = []
  if (sortPos !== undefined) {
    for (const [i, r] of reads.entries()) {
      if (r.baseAtSortPos) {
        mismatchEntries.push({
          readIdx: i,
          pos: sortPos,
          base: r.baseAtSortPos.charCodeAt(0),
        })
      }
    }
  }

  const numMismatches = mismatchEntries.length
  const mismatchPositions = new Uint32Array(numMismatches)
  const mismatchReadIndices = new Uint32Array(numMismatches)
  const mismatchBases = new Uint8Array(numMismatches)
  for (let i = 0; i < numMismatches; i++) {
    const e = mismatchEntries[i]!
    mismatchPositions[i] = e.pos
    mismatchReadIndices[i] = e.readIdx
    mismatchBases[i] = e.base
  }

  const softclipEntries = reads.flatMap((r, i) =>
    r.softclip ? [{ readIdx: i, ...r.softclip }] : [],
  )
  const numSoftclips = softclipEntries.length
  const interbasePositions = new Uint32Array(numSoftclips)
  const interbaseLengths = new Uint32Array(numSoftclips)
  const interbaseTypes = new Uint8Array(numSoftclips)
  const interbaseReadIndices = new Uint32Array(numSoftclips)
  for (let i = 0; i < numSoftclips; i++) {
    const e = softclipEntries[i]!
    interbasePositions[i] = e.pos
    interbaseLengths[i] = e.length
    interbaseTypes[i] = e.type ?? INTERBASE_SOFTCLIP
    interbaseReadIndices[i] = e.readIdx
  }

  const skipEntries = reads.flatMap((r, i) =>
    (r.skips ?? []).map(([start, end]) => ({ readIdx: i, start, end })),
  )
  const gapPositions = new Uint32Array(skipEntries.length * 2)
  const gapReadIndices = new Uint32Array(skipEntries.length)
  for (const [i, e] of skipEntries.entries()) {
    gapPositions[i * 2] = e.start
    gapPositions[i * 2 + 1] = e.end
    gapReadIndices[i] = e.readIdx
  }

  return {
    ...baseWorkerPileupData(numReads),
    readKeys,
    ...namesToBlock(readNames),
    readPositions,
    gapPositions,
    gapTypes: new Uint8Array(skipEntries.length).fill(GAP_SKIP),
    gapReadIndices,
    gapFrequencies: new Uint8Array(skipEntries.length),
    readStrands: Int8Array.from(reads.map(r => r.strand ?? 0)),
    mismatchPositions,
    mismatchBases,
    mismatchStrands: new Int8Array(numMismatches),
    mismatchReadIndices,
    mismatchFrequencies: new Uint8Array(numMismatches),
    mismatchQuals: new Uint8Array(numMismatches),
    interbasePositions,
    interbaseLengths,
    interbaseTypes,
    interbaseReadIndices,
    interbaseFrequencies: new Uint8Array(numSoftclips),
    numSoftclips,
    sortTagValues,
  }
}

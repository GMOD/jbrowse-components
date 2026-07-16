import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../shared/types.ts'

import type { PileupDataResult } from './types.ts'

// Synthetic PileupDataResult builder for layout tests. Shared (rather than
// duplicated) so the R-export equivalence test drives JBrowse's real
// computeSortedLayout over the exact same reads it hands to the R helper.
export interface Read {
  start: number
  end: number
  baseAtSortPos?: string
  tagValue?: string
  // A soft clip at genomic `pos` of `length` bp (left clip when pos <= start).
  softclip?: { pos: number; length: number }
  // An insertion / hard clip at genomic `pos`, the other two interbase kinds the
  // localized sort can key on.
  insertion?: { pos: number; length: number }
  hardclip?: { pos: number; length: number }
}

export function makePileupData(opts: {
  regionStart: number
  reads: Read[]
  sortPos?: number
  // Distinguishes reads across regions in multi-region tests; the same prefix+i
  // in two regions is treated as one boundary-spanning read (dedup by id).
  idPrefix?: string
}): PileupDataResult {
  const { reads, sortPos, idPrefix = 'id' } = opts
  const numReads = reads.length
  const hasAnyTagValue = reads.some(r => r.tagValue !== undefined)
  const sortTagValues = hasAnyTagValue
    ? reads.map(r => r.tagValue ?? '')
    : undefined

  const readPositions = new Uint32Array(numReads * 2)
  const readIds: string[] = []
  const readNames: string[] = []
  for (const [i, r] of reads.entries()) {
    readPositions[i * 2] = r.start
    readPositions[i * 2 + 1] = r.end
    readIds.push(`${idPrefix}${i}`)
    readNames.push(`${idPrefix}${i}`)
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

  // buildInterbaseArrays lays the three interbase kinds out in this order
  // (insertions, softclips, hardclips) in the real worker, so mirror it here.
  const interbaseEntries = [
    ...reads.flatMap((r, i) =>
      r.insertion
        ? [{ readIdx: i, type: INTERBASE_INSERTION, ...r.insertion }]
        : [],
    ),
    ...reads.flatMap((r, i) =>
      r.softclip
        ? [{ readIdx: i, type: INTERBASE_SOFTCLIP, ...r.softclip }]
        : [],
    ),
    ...reads.flatMap((r, i) =>
      r.hardclip
        ? [{ readIdx: i, type: INTERBASE_HARDCLIP, ...r.hardclip }]
        : [],
    ),
  ]
  const numSoftclips = reads.filter(r => r.softclip).length
  const numInterbases = interbaseEntries.length
  const interbasePositions = new Uint32Array(numInterbases)
  const interbaseLengths = new Uint16Array(numInterbases)
  const interbaseTypes = new Uint8Array(numInterbases)
  const interbaseReadIndices = new Uint32Array(numInterbases)
  for (let i = 0; i < numInterbases; i++) {
    const e = interbaseEntries[i]!
    interbasePositions[i] = e.pos
    interbaseLengths[i] = e.length
    interbaseTypes[i] = e.type
    interbaseReadIndices[i] = e.readIdx
  }

  return {
    readIds,
    readNames,
    readPositions,
    readYs: new Uint16Array(numReads),
    readFlags: new Uint16Array(numReads),
    readMapqs: new Uint8Array(numReads),
    readInsertSizes: new Float32Array(numReads),
    readPairOrientations: new Uint8Array(numReads),
    readStrands: new Int8Array(numReads),
    readInterchrom: new Uint8Array(numReads),
    readTagColors: new Uint32Array(0),
    segmentPositions: new Uint32Array(0),
    segmentReadIndices: new Uint32Array(0),
    segmentEdgeFlags: new Uint8Array(0),
    numSegments: 0,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapLengths: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapReadIndices: new Uint32Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions,
    mismatchYs: new Uint16Array(numMismatches),
    mismatchBases,
    mismatchStrands: new Int8Array(numMismatches),
    mismatchReadIndices,
    mismatchFrequencies: new Uint8Array(numMismatches),
    mismatchQuals: new Uint8Array(numMismatches),
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    softclipBaseReadIndices: new Uint32Array(0),
    interbasePositions,
    interbaseYs: new Uint16Array(numInterbases),
    interbaseLengths,
    interbaseTypes,
    interbaseReadIndices,
    interbaseSequences: [],
    interbaseFrequencies: new Uint8Array(numInterbases),
    coverageDepths: new Float32Array(0),
    coverageFwdDepths: new Float32Array(0),
    coverageRevDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartPos: 0,
    coverageStatsBinSize: 1,
    coverageStatsMins: new Float32Array(0),
    coverageStatsMaxs: new Float32Array(0),
    coverageStatsSums: new Float64Array(0),
    coverageStatsSumSqs: new Float64Array(0),
    coverageBinSize: 1,
    coverageGpuBinCount: 0,
    coveragePackedBuffer: new ArrayBuffer(0),
    snpPositions: new Uint32Array(0),
    snpYOffsets: new Float32Array(0),
    snpHeights: new Float32Array(0),
    snpColorTypes: new Uint8Array(0),
    snpRelDepths: new Float32Array(0),
    snpPackedBuffer: new ArrayBuffer(0),
    interbaseCovPositions: new Uint32Array(0),
    interbaseCovYOffsets: new Float32Array(0),
    interbaseCovHeights: new Float32Array(0),
    interbaseCovColorTypes: new Uint8Array(0),
    interbaseMaxCount: 0,
    interbasePackedBuffer: new ArrayBuffer(0),
    indicatorPositions: new Uint32Array(0),
    indicatorColorTypes: new Uint8Array(0),
    indicatorPackedBuffer: new ArrayBuffer(0),
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint32Array(0),
    modificationReadIndices: new Uint32Array(0),
    perBaseQualPositions: new Uint32Array(0),
    perBaseQualYs: new Uint16Array(0),
    perBaseQualScores: new Uint8Array(0),
    perBaseQualReadIndices: new Uint32Array(0),
    perBaseLetterPositions: new Uint32Array(0),
    perBaseLetterYs: new Uint16Array(0),
    perBaseLetterBases: new Uint8Array(0),
    perBaseLetterReadIndices: new Uint32Array(0),
    modCovPositions: new Uint32Array(0),
    modCovYOffsets: new Float32Array(0),
    modCovHeights: new Float32Array(0),
    modCovColors: new Uint32Array(0),
    modCovRelDepths: new Float32Array(0),
    modCovPackedBuffer: new ArrayBuffer(0),
    sashimiX1: new Uint32Array(0),
    sashimiX2: new Uint32Array(0),
    sashimiColorTypes: new Uint8Array(0),
    sashimiCounts: new Uint32Array(0),
    numInsertions: reads.filter(r => r.insertion).length,
    numSoftclips,
    numHardclips: reads.filter(r => r.hardclip).length,
    detectedModifications: [],
    maxY: 0,
    sortTagValues,
    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
    overlapPositions: new Uint32Array(0),
    overlapYs: new Uint16Array(0),
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
  }
}

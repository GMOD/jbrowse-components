import { getClip, getLengthOnRef } from '@jbrowse/cigar-utils'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette, RGBColor } from '../shaders/colors.ts'

// A full ColorPalette with every channel zeroed, for tests that only assert on
// a few roles. Pass `overrides` to set the colors a case actually checks; the
// explicit literal (no cast) keeps it type-safe as ColorPalette gains fields.
export function makeTestPalette(
  overrides: Partial<ColorPalette> = {},
): ColorPalette {
  const z: RGBColor = [0, 0, 0]
  return {
    colorFwdStrand: z,
    colorRevStrand: z,
    colorNostrand: z,
    colorPairLR: z,
    colorPairRL: z,
    colorPairRR: z,
    colorPairLL: z,
    colorBaseA: z,
    colorBaseC: z,
    colorBaseG: z,
    colorBaseT: z,
    colorBaseN: z,
    colorInsertion: z,
    colorDeletion: z,
    colorSkip: z,
    colorSoftclip: z,
    colorHardclip: z,
    colorInsertionIndicator: z,
    colorSoftclipIndicator: z,
    colorHardclipIndicator: z,
    colorCoverage: z,
    colorModificationFwd: z,
    colorModificationRev: z,
    colorMutedSnpBase: z,
    colorLongInsert: z,
    colorShortInsert: z,
    colorSupplementary: z,
    colorSplitInversion: z,
    colorUnmappedMate: z,
    colorInterchrom: z,
    ...overrides,
  }
}

// A full PileupDataResult with every array empty — the shape a fetch returns for
// a region with no reads. Tests that only care about a few fields spread this
// and override them, so seeding `setRpcData` exercises the real layout getters
// instead of throwing on a missing array. Like `makeTestPalette`, it stays an
// explicit literal (no cast) so it fails to compile when the result type grows.
export function makeEmptyPileupData(): PileupDataResult {
  return {
    readPositions: new Uint32Array(0),
    readYs: new Uint16Array(0),
    readFlags: new Uint16Array(0),
    readMapqs: new Uint8Array(0),
    readInsertSizes: new Float32Array(0),
    readPairOrientations: new Uint8Array(0),
    readStrands: new Int8Array(0),
    readInterchrom: new Uint8Array(0),
    readIds: [],
    readNames: [],
    segmentPositions: new Uint32Array(0),
    segmentReadIndices: new Uint32Array(0),
    segmentEdgeFlags: new Uint8Array(0),
    numSegments: 0,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapLengths: new Uint32Array(0),
    gapTypes: new Uint8Array(0),
    gapReadIndices: new Uint32Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions: new Uint32Array(0),
    mismatchYs: new Uint16Array(0),
    mismatchBases: new Uint8Array(0),
    mismatchStrands: new Int8Array(0),
    mismatchReadIndices: new Uint32Array(0),
    mismatchFrequencies: new Uint8Array(0),
    mismatchQuals: new Uint8Array(0),
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    softclipBaseReadIndices: new Uint32Array(0),
    interbasePositions: new Uint32Array(0),
    interbaseYs: new Uint16Array(0),
    interbaseLengths: new Uint32Array(0),
    interbaseTypes: new Uint8Array(0),
    interbaseReadIndices: new Uint32Array(0),
    interbaseSequences: [],
    interbaseFrequencies: new Uint8Array(0),
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
    readTagColors: new Uint32Array(0),
    readColorCategories: new Uint8Array(0),
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
    sashimiStrands: new Int8Array(0),
    sashimiCounts: new Uint32Array(0),
    maxY: 0,
    numInsertions: 0,
    numSoftclips: 0,
    numHardclips: 0,
    detectedModifications: [],
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

/**
 * One alignment record as `samtools view` prints it, reduced to the columns the
 * connection and chaining code actually consults. Lets a test be built out of
 * real records copied from a real file rather than out of invented numbers: see
 * the `realReads.*.test.ts` fixtures, which carry the samtools command that
 * produced them.
 *
 * `strand` is carried rather than derived from `flag`, because converting the
 * reverse flag to a strand is the adapter's job and no other layer is allowed
 * to redo it (see the plugin's CLAUDE.md).
 */
export interface SamRecordFixture {
  name: string
  flag: number
  strand: number
  /** 1-based POS, exactly as the record spells it. */
  pos: number
  CIGAR: string
  /** SA tag value, `''` when the record carries none. */
  SA: string
}

/**
 * The fetch result those records would arrive as. The alignment span and the
 * read-order sort key are derived here by the same `getLengthOnRef` / `getClip`
 * calls `extractFeatureArrays` makes in the worker, so a fixture pins the
 * clip-frame convention instead of assuming one.
 */
export function pileupDataFromSamRecords(
  records: SamRecordFixture[],
): PileupDataResult {
  const n = records.length
  const readPositions = new Uint32Array(n * 2)
  const readFlags = new Uint16Array(n)
  const readStrands = new Int8Array(n)
  const readClipAtStart = new Uint32Array(n)
  for (const [i, rec] of records.entries()) {
    const start = rec.pos - 1
    readPositions[i * 2] = start
    readPositions[i * 2 + 1] = start + getLengthOnRef(rec.CIGAR)
    readFlags[i] = rec.flag
    readStrands[i] = rec.strand
    readClipAtStart[i] = getClip(rec.CIGAR, rec.strand)
  }
  return {
    ...makeEmptyPileupData(),
    readPositions,
    readFlags,
    readStrands,
    readClipAtStart,
    // ids are per-record and distinct; names are the QNAME, which split
    // segments of one read share and which is what groups them
    readIds: records.map((_, i) => `id${i}`),
    readNames: records.map(rec => rec.name),
    readSuppAlignments: records.map(rec => rec.SA),
  }
}

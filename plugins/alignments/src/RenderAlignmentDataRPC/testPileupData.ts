import {
  packIndicatorInstances,
  packInterbaseInstances,
} from '@jbrowse/alignments-core'

import { emptyModTooltipIndex } from '../shared/modTooltipIndex.ts'
import { namesToBlock } from '../shared/readNameBlock.ts'

import type { PileupDataResult } from './types.ts'

/**
 * A `PileupDataResult` satisfying the whole contract: every REQUIRED field
 * present, per-read arrays sized to `numReads`, everything else empty. Spread it
 * as the base of a fixture and override the handful of fields the test is about.
 *
 * It exists so a fixture never needs `as unknown as PileupDataResult`, and that
 * cast is the point. The DTO has 103 required fields, so no test sets them all,
 * and the cast let a fixture omit one silently — which stayed harmless exactly
 * until production code started reading it. `readInterchrom` is the worked
 * example: the connection classifier began reading it, and two fixtures that had
 * never carried it failed with `Cannot read properties of undefined`, in a
 * module whose own tests were otherwise green.
 *
 * OPTIONAL fields are deliberately absent. `readChainHasSupp`, `chainNames`,
 * `readClipAtStart` and the rest are what `isChainData` narrows on and what the
 * `?.  ?? default` readers fall back from, so filling them would quietly switch
 * tests onto the other branch. A fixture that wants chain mode says so.
 *
 * Lives beside the type rather than in a test-utils bucket: adding a required
 * field to `PileupDataResult` is what makes this file wrong, and this is where
 * whoever adds it will be looking.
 */
/**
 * `basePileupDataResult` with the fixture's own fields spread over it, sized
 * from whichever per-read array it supplied.
 *
 * The reason to prefer this over the cast is not that a fixture must be
 * complete — it never is, and 103 fields say so. It is that an object literal
 * passed as `Partial<PileupDataResult>` gets EXCESS PROPERTY CHECKING, so a
 * misspelled field is a compile error here and was silently accepted before:
 * `as unknown as` accepts any shape at all, including one whose keys the
 * production code never reads.
 */
export function makePileupDataResult(
  overrides: Partial<PileupDataResult>,
): PileupDataResult {
  const n = overrides.readPositions
    ? overrides.readPositions.length / 2
    : (overrides.readFlags?.length ??
      overrides.readStrands?.length ??
      overrides.readKeys?.length ??
      (overrides.readNameOffsets && overrides.readNameOffsets.length - 1) ??
      0)
  return { ...basePileupDataResult(n), ...overrides }
}

export function basePileupDataResult(numReads: number): PileupDataResult {
  const n = numReads
  return {
    readPositions: new Uint32Array(n * 2),
    readYs: new Uint16Array(n),
    readFlags: new Uint16Array(n),
    readMapqs: new Uint8Array(n),
    readInsertSizes: new Float32Array(n),
    readPairOrientations: new Uint8Array(n),
    readStrands: new Int8Array(n),
    readInterchrom: new Uint8Array(n),
    // The string branch of `readKeys` (shared/readIdentity.ts): a fixture read
    // is named by its whole id, as it is for a SAM or PAF-backed display. The
    // numeric branch is covered by readIdentity.test.ts and the numeric cases in
    // sortLayout.test.ts, since it changes the canonical tiebreak from a
    // lexicographic compare to a numeric one.
    readKeys: Array.from({ length: n }, (_, i) => `id${i}`),
    readIdPrefix: undefined,
    // `read0read1...` with the offsets that cut it back up, which is the shape
    // the worker ships (shared/readNameBlock.ts).
    ...namesToBlock(Array.from({ length: n }, (_, i) => `read${i}`)),
    // No mate anywhere, which is the `-1` slot — a fixture that wants
    // interchromosomal reads sets `readNextRefIds` and `nextRefNames` together.
    readNextRefIds: new Int32Array(n).fill(-1),
    nextRefNames: [],
    readTagColors: new Uint32Array(0),
    readColorCategories: new Uint8Array(0),
    segmentPositions: new Uint32Array(n * 2),
    segmentReadIndices: new Uint32Array(n),
    segmentEdgeFlags: new Uint8Array(n),
    numSegments: n,
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
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
    snpPackedBuffer: new ArrayBuffer(0),
    interbaseMaxCount: 0,
    interbasePackedBuffer: new ArrayBuffer(0),
    indicatorPackedBuffer: new ArrayBuffer(0),
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint32Array(0),
    modificationReadIndices: new Uint32Array(0),
    ...emptyModTooltipIndex(),
    perBaseQualPositions: new Uint32Array(0),
    perBaseQualYs: new Uint16Array(0),
    perBaseQualScores: new Uint8Array(0),
    perBaseQualReadIndices: new Uint32Array(0),
    perBaseLetterPositions: new Uint32Array(0),
    perBaseLetterYs: new Uint16Array(0),
    perBaseLetterBases: new Uint8Array(0),
    perBaseLetterReadIndices: new Uint32Array(0),
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
 * The interbase histogram's instance buffer, for a fixture that needs bars to
 * hit-test or draw.
 *
 * Production writes this buffer inside `computeInterbaseCoverage`, which is the
 * only place segments come from — so a fixture stating a bar directly would
 * otherwise have to arrange the reads AND the read depth that make the worker
 * emit one. `yOffset`/`height` are stack fractions of the full-scale bar, and
 * segments at one position must be listed consecutively and in ascending
 * position order, which is the contract the hit test's run walk reads.
 *
 * Interleaved by interbaseHistogram.slang's own generated `packInstances`, so a
 * fixture cannot encode a record the shader would decode differently.
 */
export function packedInterbaseSegments(
  segments: {
    position: number
    yOffset: number
    height: number
    colorType: number
  }[],
) {
  return packInterbaseInstances(
    {
      position: segments.map(s => s.position),
      yOffset: segments.map(s => s.yOffset),
      segHeight: segments.map(s => s.height),
      colorType: segments.map(s => s.colorType),
    },
    segments.length,
  )
}

/** The indicator-triangle instance buffer; see `packedInterbaseSegments`. */
export function packedIndicators(
  indicators: { position: number; colorType: number }[],
) {
  return packIndicatorInstances(
    {
      position: indicators.map(i => i.position),
      colorType: indicators.map(i => i.colorType),
    },
    indicators.length,
  )
}

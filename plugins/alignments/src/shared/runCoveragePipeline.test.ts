import { readModCovSegments, readSnpSegments } from '@jbrowse/alignments-core'
import { packAbgr } from '@jbrowse/core/util/colorBits'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { runCoveragePipeline } from './runCoveragePipeline.ts'

import type { StrandBaseCounts } from './calculateModificationCounts.ts'
import type {
  FeatureData,
  GapData,
  InsertionData,
  ModificationEntry,
} from './webglRpcTypes.ts'
import type { Region } from '@jbrowse/core/util'

// 40 reads spanning the whole region → depth 40 everywhere. A mismatch shared by
// 20 of them at pos 50 → 20/40 = 50% frequency, which survives the depth-40
// threshold (0.3) and lands at round(0.5*255)=128. That exact value (not 0 and
// not 255) proves the frequency was computed from the real depth sweep.
const region: Region = {
  refName: 'chr1',
  start: 0,
  end: 100,
  assemblyName: 'test',
}
const READS = 40
const MISMATCHES = 20
const MISMATCH_POS = 50

const features: FeatureData[] = Array.from({ length: READS }, (_, i) => ({
  id: `r${i}`,
  name: `r${i}`,
  start: 0,
  end: 100,
  flags: 0,
  mapq: 60,
  insertSize: 0,
  pairOrientation: 1,
  strand: 1,
}))

const mismatchArrays = {
  mismatchPositions: new Uint32Array(MISMATCHES).fill(MISMATCH_POS),
  mismatchBases: new Uint8Array(MISMATCHES).fill(65), // 'A'
}
const interbaseArrays = {
  interbasePositions: new Uint32Array(0),
  interbaseTypes: new Uint8Array(0),
}
const gapArrays = {
  gapPositions: new Uint32Array(0),
  gapTypes: new Uint8Array(0),
}

const baseArgs = {
  features,
  gaps: [] as GapData[],
  insertions: [] as InsertionData[],
  softclips: [],
  hardclips: [],
  modifications: [],
  modBaseCounts: new Map<number, StrandBaseCounts>(),
  bisulfiteCallCounts: new Map<number, number>(),
  simplexModifications: new Set<string>(),
  bisulfite: false,
  region,
  mismatchArrays,
  interbaseArrays,
  gapArrays,
  statusCallback: () => {},
  stopTokenCheck: createStopTokenChecker(undefined),
}

describe('runCoveragePipeline coverage-band gate', () => {
  test('showCoverage off skips the band but keeps frequencies identical', async () => {
    const withBand = await runCoveragePipeline({
      ...baseArgs,
      showCoverage: true,
    })
    const noBand = await runCoveragePipeline({
      ...baseArgs,
      showCoverage: false,
    })

    // The band-off run allocates none of the per-bp depth buffer that trips the
    // GPU device-limit crash at whole-chromosome scale.
    expect(withBand.coverage.depths.length).toBe(100)
    expect(noBand.coverage.depths.length).toBe(0)
    // Asserted on the packed buffers because they are the only form these
    // layers ship in — the compute results stay inside computeCoverageBand.
    const packedOff = noBand.coverageAreaPacked
    expect(packedOff.coveragePackedBuffer.byteLength).toBe(0)
    expect(packedOff.snpPackedBuffer.byteLength).toBe(0)
    expect(packedOff.interbasePackedBuffer.byteLength).toBe(0)
    expect(packedOff.modCovPackedBuffer.byteLength).toBe(0)
    expect(noBand.sashimi.sashimiX1.length).toBe(0)

    // With the band on, the SNP segment IS produced (50% variant at depth 40).
    const snp = readSnpSegments(withBand.coverageAreaPacked.snpPackedBuffer)
    expect(snp).toHaveLength(1)
    expect(snp[0]!.position).toBe(MISMATCH_POS)
    expect(snp[0]!.height).toBeCloseTo(MISMATCHES / READS)

    // The critical coupling: the low-frequency pileup fade must not depend on
    // whether the coverage band is drawn. Frequencies are byte-identical, and
    // the depth-derived 128 (50% of 255) confirms they read the real depth.
    expect(Array.from(noBand.mismatchFrequencies)).toEqual(
      new Array(MISMATCHES).fill(128),
    )
    expect(Array.from(noBand.mismatchFrequencies)).toEqual(
      Array.from(withBand.mismatchFrequencies),
    )
    expect(Array.from(noBand.interbaseFrequencies)).toEqual(
      Array.from(withBand.interbaseFrequencies),
    )
    expect(Array.from(noBand.gapFrequencies)).toEqual(
      Array.from(withBand.gapFrequencies),
    )
  })
})

describe('runCoveragePipeline bisulfite mod coverage', () => {
  // 30 methylated + 10 unmethylated C->T calls at one position, and NO base-count
  // pileup (baseArgs.modBaseCounts is empty). The bisulfite path must fill the
  // whole bar 0.75/0.25 from the calls alone — the modBAM path would need the
  // base counts and would cap the methylated share near 0.5.
  function bisulfiteCalls(pos: number) {
    const at = (noMod: boolean, count: number, color: number) =>
      Array.from({ length: count }, (_, readIndex): ModificationEntry => ({
        readIndex,
        position: pos,
        base: 'C',
        modType: 'm',
        strand: 1,
        color,
        prob: 1,
        noMod,
      }))
    return [
      ...at(false, 30, packAbgr(255, 0, 0, 255)),
      ...at(true, 10, packAbgr(0, 0, 255, 255)),
    ]
  }

  test('bisulfite=true fills the whole coverage bar from C->T calls alone', async () => {
    const out = await runCoveragePipeline({
      ...baseArgs,
      modifications: bisulfiteCalls(MISMATCH_POS),
      bisulfiteCallCounts: new Map([[MISMATCH_POS, 40]]),
      showCoverage: true,
      trackStrands: true,
      bisulfite: true,
    })
    const segments = readModCovSegments(
      out.coverageAreaPacked.modCovPackedBuffer,
    )
    expect(segments).toHaveLength(2)
    const heights = segments.map(s => s.height)
    expect(heights[0]).toBeCloseTo(0.75) // methylated, bottom
    expect(heights[1]).toBeCloseTo(0.25) // unmethylated, top
    expect(heights[0]! + heights[1]!).toBeCloseTo(1)
  })

  test('single-color: the tally still reaches the height arithmetic', async () => {
    // Single-color mode paints only the 30 methylated marks, so the 40-call
    // tally is the pipeline's ONLY way to know the level is 0.75. If it stops
    // being threaded through, the bar comes back at full height.
    const out = await runCoveragePipeline({
      ...baseArgs,
      modifications: bisulfiteCalls(MISMATCH_POS).filter(m => !m.noMod),
      bisulfiteCallCounts: new Map([[MISMATCH_POS, 40]]),
      showCoverage: true,
      trackStrands: true,
      bisulfite: true,
    })
    const segments = readModCovSegments(
      out.coverageAreaPacked.modCovPackedBuffer,
    )
    expect(segments).toHaveLength(1)
    expect(segments[0]!.height).toBeCloseTo(0.75)
  })
})

import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { runCoveragePipeline } from './runCoveragePipeline.ts'

import type { StrandBaseCounts } from './calculateModificationCounts.ts'
import type { FeatureData, GapData, InsertionData } from './webglRpcTypes.ts'
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
const interbaseArrays = { interbasePositions: new Uint32Array(0) }
const gapArrays = { gapPositions: new Uint32Array(0) }

const baseArgs = {
  features,
  gaps: [] as GapData[],
  insertions: [] as InsertionData[],
  softclips: [],
  hardclips: [],
  modifications: [],
  modBaseCounts: new Map<number, StrandBaseCounts>(),
  simplexModifications: new Set<string>(),
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
    expect(noBand.coverageAreaPacked.coveragePackedBuffer.byteLength).toBe(0)
    expect(noBand.snpCoverage.count).toBe(0)
    expect(noBand.interbaseCoverage.segmentCount).toBe(0)
    expect(noBand.sashimi.sashimiX1.length).toBe(0)
    expect(noBand.modCoverage).toBeUndefined()

    // With the band on, the SNP segment IS produced (50% variant at depth 40).
    expect(withBand.snpCoverage.count).toBeGreaterThan(0)

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

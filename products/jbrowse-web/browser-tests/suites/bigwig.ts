import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestCase, TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

function gcContentTrack(extra: Record<string, unknown>) {
  return {
    trackId: 'volvox_gc',
    displaySnapshot: {
      type: 'LinearGCContentTrackDisplay',
      windowSize: 500,
      windowDelta: 500,
      ...extra,
    },
  }
}

interface LiveModel {
  JBrowseSession: {
    views: {
      bpPerPx: number
      tracks: {
        displays: {
          loadedRegions: ReadonlyMap<
            number,
            {
              payload?: {
                zoomRange?: { minBpPerPx: number; maxBpPerPx: number }
                sources: {
                  featurePositions: Uint32Array
                  numFeatures: number
                  hasSummaryScores: boolean
                }[]
              }
            }
          >
        }[]
      }[]
    }[]
  }
}

// Reads back the payload the display drew: a synthetic tier declares
// [bin/2, next/2) and ships min/max rows starting on bin boundaries, where
// the raw section would ship 1bp records with no min/max.
async function expectSyntheticTier(
  page: Page,
  bin: number,
  maxBpPerPx: number,
) {
  const tier = await page.evaluate(() => {
    const view = (window as unknown as LiveModel).JBrowseSession.views[0]!
    const payload = view.tracks[0]!.displays[0]!.loadedRegions.get(0)?.payload
    return {
      bpPerPx: view.bpPerPx,
      zoomRange: payload?.zoomRange,
      sources: payload?.sources.map(s => {
        const starts = Array.from(
          { length: s.numFeatures },
          (_, i) => s.featurePositions[i * 2]!,
        )
        return {
          hasSummaryScores: s.hasSummaryScores,
          numFeatures: s.numFeatures,
          starts: starts.slice(1),
        }
      }),
    }
  })
  const expected = { minBpPerPx: bin / 2, maxBpPerPx }
  const { bpPerPx, zoomRange, sources = [] } = tier
  const misaligned = sources.flatMap(s => s.starts.filter(x => x % bin !== 0))
  if (
    JSON.stringify(zoomRange) !== JSON.stringify(expected) ||
    bpPerPx < expected.minBpPerPx ||
    bpPerPx >= maxBpPerPx ||
    sources.length === 0 ||
    sources.some(s => !s.hasSummaryScores || s.numFeatures === 0) ||
    misaligned.length > 0
  ) {
    throw new Error(
      `expected the ${bin}bp synthetic tier, got ${JSON.stringify({
        bpPerPx,
        zoomRange,
        sources: sources.map(s => [s.hasSummaryScores, s.numFeatures]),
        misaligned: misaligned.slice(0, 5),
      })}`,
    )
  }
}

// synthetic_tiers_{a,b}.bw hold 1bp records over ctgA:1001-17000 under a 34bp
// first zoom level, so the adapter bins them at 4bp from 2 to 8 bp/px and at
// 16bp from 8 to 17 (ADR-129). generate_synthetic_tier_bigwig.mjs writes them.
function syntheticTierTest({
  track,
  bin,
}: {
  track: string
  bin: 4 | 16
}): TestCase {
  const { loc, maxBpPerPx } =
    bin === 16
      ? { loc: 'ctgA:1001-17000', maxBpPerPx: 17 }
      : { loc: 'ctgA:8001-13000', maxBpPerPx: 8 }
  const snapshotTest = lgvSnapshotTest({
    name: '',
    snapshot: `bigwig-${track.replaceAll('_', '-')}-${bin}bp`,
    loc,
    tracks: [track],
    config: 'test_data/volvox/config_synthetic_tiers.json',
    displayTestId: track.includes('multi')
      ? 'wiggle-display'
      : 'wiggle-display',
  })
  return {
    name: `${track} on the ${bin}bp synthetic tier`,
    fn: async page => {
      await snapshotTest.fn(page)
      await expectSyntheticTier(page, bin, maxBpPerPx)
    },
  }
}

// All views here are also asserted by the golden snapshot of the same canvas
// (the content-gate in canvasSnapshot fails a blank/empty render), so the
// goldens lock in the rendered colors — no bespoke pixel-sniffing needed.
const suite: TestSuite = {
  name: 'BigWig Tracks',
  tests: [
    lgvSnapshotTest({
      name: 'GC content track',
      snapshot: 'bigwig-gc-content',
      loc: 'ctgA:1-30000',
      tracks: [gcContentTrack({})],
      displayTestId: 'wiggle-display',
    }),
    lgvSnapshotTest({
      name: 'GC skew track',
      snapshot: 'bigwig-gc-skew',
      loc: 'ctgA:1-30000',
      tracks: [gcContentTrack({ gcMode: 'skew' })],
      displayTestId: 'wiggle-display',
    }),
    lgvSnapshotTest({
      name: 'MultiBigWig xyplot',
      snapshot: 'bigwig-multibigwig-xyplot',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_microarray_multi'],
      displayTestId: 'wiggle-display',
    }),
    lgvSnapshotTest({
      name: 'MultiBigWig multirowxy',
      snapshot: 'bigwig-multibigwig-multirowxy',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_microarray_multi_multirowxy'],
      displayTestId: 'wiggle-display',
    }),
    lgvSnapshotTest({
      name: 'MultiBigWig multirowdensity',
      snapshot: 'bigwig-multibigwig-multirowdensity',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_microarray_multi_multirowdensity'],
      displayTestId: 'wiggle-display',
    }),
    lgvSnapshotTest({
      name: 'MultiBigWig multirowline',
      snapshot: 'bigwig-multibigwig-multirowline',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_microarray_multi_multirowline'],
      displayTestId: 'wiggle-display',
    }),
    syntheticTierTest({ track: 'synthetic_tiers_line_avg', bin: 16 }),
    syntheticTierTest({ track: 'synthetic_tiers_line_whiskers', bin: 16 }),
    syntheticTierTest({ track: 'synthetic_tiers_xyplot_avg', bin: 16 }),
    syntheticTierTest({ track: 'synthetic_tiers_xyplot_whiskers', bin: 16 }),
    syntheticTierTest({ track: 'synthetic_tiers_line_whiskers', bin: 4 }),
    syntheticTierTest({ track: 'synthetic_tiers_multiline_whiskers', bin: 16 }),
  ],
}

export default suite

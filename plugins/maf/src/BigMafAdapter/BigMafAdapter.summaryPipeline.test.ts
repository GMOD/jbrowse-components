import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BigMafAdapter from './BigMafAdapter.ts'
import configSchema from './configSchema.ts'
import BigBedAdapter from '../../../bed/src/BigBedAdapter/BigBedAdapter.ts'
import bigBedConfigSchema from '../../../bed/src/BigBedAdapter/configSchema.ts'
import { computeVisibleSummaryBars } from '../LinearMafDisplay/components/computeVisibleSummaryBars.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

// End-to-end coverage of the zoom-out summary path that no single unit test
// spans: the records a real bigMafSummary.bb yields through
// `getSummaryFeatures` (the worker side) must drive `computeVisibleSummaryBars`
// (the render side) without a field/coordinate mismatch. The summary RPC
// (`LinearMafGetSummaryData`) and `setSummaryData` are transparent pass-throughs
// — they collect/store these records verbatim — so wiring the two units with
// the real fixture mirrors production. Catches a species-name (`src`) or
// start/end regression that the isolated unit tests, which use synthetic
// records, would not.
const summaryAdapter = new BigBedAdapter(
  bigBedConfigSchema.create({
    type: 'BigBedAdapter',
    bigBedLocation: {
      localPath: require.resolve('../../test_data/cactus447way.summary.bb'),
      locationType: 'LocalPathLocation',
    },
  }),
)

const getSummarySubAdapter: getSubAdapterType = async () => ({
  dataAdapter: summaryAdapter,
  sessionIds: new Set<string>(),
})

// The fixture covers hg38 chr1:1,000,000-1,050,000.
const REGION_START = 1_000_000
const REGION_END = 1_050_000

test('real bigMafSummary records render to positioned bars on their species rows', async () => {
  const adapter = new BigMafAdapter(
    configSchema.create({
      type: 'BigMafAdapter',
      summaryAdapter: { type: 'BigBedAdapter' },
    }),
    getSummarySubAdapter,
  )

  const records = await firstValueFrom(
    adapter
      .getSummaryFeatures({
        assemblyName: 'hg38',
        refName: 'chr1',
        start: REGION_START,
        end: REGION_END,
      })
      .pipe(toArray()),
  )
  expect(records.length).toBeGreaterThan(0)

  // Real species names — what the track's `sources`/`rowIndexBySrc` resolve
  // against in production. Take a subset so the test also proves src-filtering
  // (rows whose src isn't listed are dropped).
  const allSrcs = [...new Set(records.map(r => r.src))]
  expect(allSrcs.length).toBeGreaterThan(1)
  const chosen = allSrcs.slice(0, 3)
  const rowIndexBySrc = new Map(chosen.map((src, i) => [src, i]))

  const bpPerPx = 25 // 50kb region -> 2000px
  const viewWidthPx = (REGION_END - REGION_START) / bpPerPx
  const rowHeight = 15

  const bars = computeVisibleSummaryBars({
    view: {
      bpPerPx,
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start: REGION_START,
          end: REGION_END,
          screenStartPx: 0,
          reversed: false,
        },
      ],
    },
    summaryDataMap: { get: () => records },
    rowIndexBySrc,
    rowHeight,
    rowProportion: 0.8,
  })

  // One bar per record whose species is in the chosen subset (src-filtering).
  const expectedCount = records.filter(r => rowIndexBySrc.has(r.src)).length
  expect(expectedCount).toBeGreaterThan(0)
  expect(bars).toHaveLength(expectedCount)
  // The subset really is a filter, not the whole set.
  expect(bars.length).toBeLessThan(records.length)

  for (const b of bars) {
    // Blocks overlapping the region edges extend past the viewport (clipped by
    // the canvas, not here) — assert each bar at least overlaps [0, width].
    expect(Number.isFinite(b.x)).toBe(true)
    expect(b.x).toBeLessThan(viewWidthPx)
    expect(b.x + b.width).toBeGreaterThan(0)
    expect(b.width).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(b.score)).toBe(true)
    expect(b.rowTop).toBeGreaterThanOrEqual(0)
    expect(b.rowTop).toBeLessThan(chosen.length * rowHeight)
  }
})

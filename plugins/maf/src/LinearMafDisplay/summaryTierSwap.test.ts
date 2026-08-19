import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment } from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

const env = () =>
  createMafTestEnvironment({ summaryAdapter: { type: 'BigBedAdapter' } })

function seedSources(display: LinearMafDisplayModel) {
  display.setSamples({
    samples: [
      { id: 'hg38', label: 'hg38' },
      { id: 'panTro4', label: 'panTro4' },
    ],
    treeNewick: undefined,
    samplesCanonical: true,
  })
}

function seedSummary(display: LinearMafDisplayModel) {
  display.setSummaryData(0, [
    { refName: 'ctgA', start: 100, end: 4000, src: 'hg38', score: 0.9 },
    { refName: 'ctgA', start: 100, end: 4000, src: 'panTro4', score: 0.4 },
  ])
}

function seedAlignment(display: LinearMafDisplayModel) {
  display.setRpcData(
    0,
    testWireRegionData(
      [
        {
          startBp: 100,
          refSeq: 'ACGTT',
          rows: [
            { sampleId: 'hg38', seq: 'ACGTT' },
            { sampleId: 'panTro4', seq: 'ACGTT' },
          ],
        },
      ],
      { coverage: emptyMafCoverage(100) },
    ),
  )
}

// Zooming in past the summary floor lands spatially inside the region the
// summary fetch already loaded, so `viewportWithinLoadedData` is true and
// `canvasDrawn` is already set — the display reads as `ready`. But the summary
// fetch cleared `rpcDataMap` on the way out, so the rows had nothing in them
// until the alignment RPC returned: a blank, un-scrimmed track for the 600ms
// fetch debounce plus however long a deep alignment takes to come back.
//
// The rows we could still draw were the ones that had just been switched off,
// so the bars now stand in per region until that region's alignment lands.
describe('the summary bars stand in until the alignment lands', () => {
  it('keeps drawing them below the floor while the alignment is missing', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    seedSummary(display)

    view.zoomTo(100)
    expect(display.showSummary).toBe(true)
    expect(display.visibleSummaryBars).toHaveLength(2)

    // the swap back in: the tier decision flips a beat before the fetch it
    // triggers can land
    view.zoomTo(1)
    expect(display.showSummary).toBe(false)
    expect(display.rpcDataMap.size).toBe(0)
    expect(display.visibleSummaryBars).toHaveLength(2)
  })

  it('drops them for a region the moment its alignment arrives', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    seedSummary(display)
    view.zoomTo(1)
    expect(display.visibleSummaryBars).toHaveLength(2)

    seedAlignment(display)
    expect(display.visibleSummaryBars).toEqual([])
  })

  // The tiers arrive per region, so the suppression is per region too: the one
  // under the cursor can be showing bases while its neighbour is still bars.
  it('suppresses only the regions that have alignment', () => {
    const { display, view } = env().createDisplay({
      regions: [
        { assemblyName: 'volvox', start: 0, end: 5000, refName: 'ctgA' },
        { assemblyName: 'volvox', start: 5000, end: 10_000, refName: 'ctgA' },
      ],
    })
    seedSources(display)
    seedSummary(display)
    display.setSummaryData(1, [
      { refName: 'ctgA', start: 5100, end: 6000, src: 'hg38', score: 0.5 },
    ])
    // both regions on screen at once, and still under the 20kb floor
    view.zoomTo(12.5)
    expect(display.showSummary).toBe(false)
    expect(display.visibleSummaryBars).toHaveLength(3)

    seedAlignment(display) // region 0 only
    expect(display.visibleSummaryBars.map(b => b.start)).toEqual([5100])
  })

  // Zooming back out reuses the summary cache — `regionHasData` is satisfied, so
  // no fetch runs and `clearAlignmentData` never does either. Both maps then
  // hold the region, and the bars are what is on screen, so the presence of
  // alignment data must not suppress them there.
  it('draws them on the summary tier even with alignment still cached', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    seedSummary(display)
    seedAlignment(display)

    view.zoomTo(1)
    expect(display.visibleSummaryBars).toEqual([])

    view.zoomTo(100)
    expect(display.showSummary).toBe(true)
    expect(display.rpcDataMap.size).toBe(1)
    expect(display.visibleSummaryBars).toHaveLength(2)
  })

  // The tier is the presence hook (`regionHasData`), not `regionFetchKey`,
  // which stays empty here. A summary/detail key would read as stale the moment
  // the tier flipped and re-read the summary adapter on every zoom back out —
  // the retention `clearAlignmentData`'s one-directional clear exists to buy.
  it('leaves both tiers cache-valid, so the zoom back out refetches nothing', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    display.setLoadedRegion(0, view.displayedRegions[0])
    seedSummary(display)
    seedAlignment(display)

    view.zoomTo(1)
    expect(display.showSummary).toBe(false)
    expect(display.isCacheValid(0)).toBe(true)

    view.zoomTo(100)
    expect(display.showSummary).toBe(true)
    expect(display.isCacheValid(0)).toBe(true)
  })

  // ...and the tier the zoom asks for is the one that has to hold it: a
  // too-large region is marked loaded and stores nothing, and that is what
  // refetches it when the gate releases.
  it('is cache-invalid on the tier whose map is empty', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    display.setLoadedRegion(0, view.displayedRegions[0])
    seedSummary(display)

    view.zoomTo(100)
    expect(display.showSummary).toBe(true)
    expect(display.isCacheValid(0)).toBe(true)

    view.zoomTo(1)
    expect(display.showSummary).toBe(false)
    expect(display.isCacheValid(0)).toBe(false)
  })

  // A track with no summary file has nothing to stand in with, and must not
  // start paying for the check.
  it('stays empty when no summary has ever been fetched', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    seedSources(display)
    view.zoomTo(100)
    expect(display.showSummary).toBe(false)
    expect(display.visibleSummaryBars).toEqual([])
  })
})

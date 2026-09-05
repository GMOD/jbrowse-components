import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { MafFrameRecord } from '../types.ts'
import type { LinearMafDisplayModel } from './stateModel.ts'
import type { Region } from '@jbrowse/core/util'

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

const REGION_0 = {
  data: [
    { refName: 'ctgA', start: 100, end: 4000, src: 'hg38', score: 0.9 },
    { refName: 'ctgA', start: 100, end: 4000, src: 'panTro4', score: 0.4 },
  ],
  frames: undefined,
}

// The summary read over the whole displayed region, stamped with its own span
// the way the tier's read stamps it.
function seedSummary(
  display: LinearMafDisplayModel,
  regions: Region[],
  extra: { displayedRegionIndex: number; payload: typeof REGION_0 }[] = [],
  frames?: MafFrameRecord[],
) {
  display.setCoarseTier(
    [{ displayedRegionIndex: 0, payload: { ...REGION_0, frames } }, ...extra],
    {
      regions: regions.map((region, displayedRegionIndex) => ({
        region,
        displayedRegionIndex,
      })),
      key: display.coarseTierIssueKey,
    },
  )
}

function seedAlignment(
  display: LinearMafDisplayModel,
  region?: Region,
  frames?: MafFrameRecord[],
) {
  stageDetailRegion(
    display,
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
    { region, frames },
  )
}

// Zooming in past the summary floor lands spatially inside the region the
// summary fetch already loaded, so `viewportWithinLoadedData` is true and
// `canvasDrawn` is already set — the display reads as `ready`. But the rows had
// nothing in them until the alignment RPC returned: a blank, un-scrimmed track
// for the 600ms fetch debounce plus however long a deep alignment takes to
// come back.
//
// The rows we could still draw were the ones that had just been switched off,
// so the bars now stand in per region until that region's alignment lands.
describe('the summary bars stand in until the alignment lands', () => {
  it('keeps drawing them below the floor while the alignment is missing', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    seedSummary(display, view.displayedRegions)

    view.zoomTo(100)
    expect(display.coarseTierActive).toBe(true)
    expect(display.visibleSummaryBars).toHaveLength(2)

    // the swap back in: the tier decision flips a beat before the fetch it
    // triggers can land
    view.zoomTo(1)
    expect(display.coarseTierActive).toBe(false)
    expect(display.rpcDataMap.size).toBe(0)
    expect(display.visibleSummaryBars).toHaveLength(2)
  })

  it('drops them for a region the moment its alignment arrives', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    seedSummary(display, view.displayedRegions)
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
    seedSummary(display, view.displayedRegions, [
      {
        displayedRegionIndex: 1,
        payload: {
          data: [
            {
              refName: 'ctgA',
              start: 5100,
              end: 6000,
              src: 'hg38',
              score: 0.5,
            },
          ],
          frames: undefined,
        },
      },
    ])
    // both regions on screen at once, and still under the 20kb floor
    view.zoomTo(12.5)
    expect(display.coarseTierActive).toBe(false)
    expect(display.visibleSummaryBars).toHaveLength(3)

    seedAlignment(display) // region 0 only
    expect(display.visibleSummaryBars.map(b => b.start)).toEqual([5100])
  })

  // Zooming back out reuses the summary read, and the detail store keeps its
  // rows under the tier. Both maps then hold the region, and the bars are what
  // is on screen, so the presence of alignment data must not suppress them
  // there.
  it('draws them on the summary tier even with alignment still cached', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    seedSummary(display, view.displayedRegions)
    seedAlignment(display)

    view.zoomTo(1)
    expect(display.visibleSummaryBars).toEqual([])

    view.zoomTo(100)
    expect(display.coarseTierActive).toBe(true)
    expect(display.rpcDataMap.size).toBe(1)
    expect(display.visibleSummaryBars).toHaveLength(2)
  })

  // A track with no summary file has nothing to stand in with, and must not
  // start paying for the check.
  it('stays empty when no summary has ever been fetched', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    seedSources(display)
    view.zoomTo(100)
    expect(display.coarseTierActive).toBe(false)
    expect(display.visibleSummaryBars).toEqual([])
  })
})

// The two tiers hold their own spans. A detail fetch zoomed in stamps
// `loadedRegions` with its narrow buffered span; the summary read keeps the
// wide one it was issued over. Under one shared entry the detail stamp
// overwrote the summary's, and zooming back out re-read the byte-gated summary
// adapter about an octave later — `maf-tiers-share-one-loaded-span` — which
// the old seeding, one stamp over the whole region, could not see.
describe('each tier answers for its own span', () => {
  const narrowDetail = (view: { displayedRegions: Region[] }) => ({
    ...view.displayedRegions[0]!,
    start: 3000,
    end: 4000,
  })

  it('keeps the summary read wide across a narrow detail fetch', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    seedSummary(display, view.displayedRegions)

    view.zoomTo(1)
    expect(display.coarseTierActive).toBe(false)
    seedAlignment(display, narrowDetail(view))

    view.zoomTo(100)
    expect(display.coarseTierActive).toBe(true)
    expect(display.coarseTierRead?.regions[0]?.region.end).toBe(
      view.displayedRegions[0]!.end,
    )
    expect(display.loadedRegions.get(0)?.end).toBe(4000)
  })

  // The detail store's cache question is the foundation's alone: on the
  // summary tier the detail fetch is suspended, so the narrow stamp is never
  // consulted there and never widened by a summary read either.
  it('suspends the detail fetch on the summary tier and leaves its stamp alone', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    seedSummary(display, view.displayedRegions)
    view.zoomTo(1)
    seedAlignment(display, narrowDetail(view))
    expect(display.fetchSuspended).toBe(false)
    expect(display.viewportWithinLoadedData).toBe(false)

    view.zoomTo(100)
    expect(display.fetchSuspended).toBe(true)
    expect(display.loadedRegions.get(0)?.start).toBe(3000)
    expect(display.displayPhase).toBe('ready')
  })

  it('is loading on the summary tier until its read lands, whatever the detail store holds', () => {
    const { display, view } = env().createDisplay()
    seedSources(display)
    display.setLoadedRegion(0, view.displayedRegions[0], undefined)
    seedAlignment(display)

    view.zoomTo(100)
    expect(display.coarseTierActive).toBe(true)
    expect(display.displayPhase).toBe('loading')

    seedSummary(display, view.displayedRegions)
    expect(display.displayPhase).toBe('ready')
  })
})

// The CDS frames ride each tier's payload, and the overlay reads the tier on
// screen first — its frames were read over the span it is drawing — with the
// other tier standing in where it holds none. That is what keeps the strip up
// across the swap while the incoming tier's read is in flight.
describe('the frames overlay across the swap', () => {
  const framesEnv = () =>
    createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
      annotationAdapter: { type: 'BigBedAdapter' },
    })
  const frame = (name: string): MafFrameRecord => ({
    refName: 'ctgA',
    start: 100,
    end: 400,
    src: 'hg38',
    frame: 0,
    strand: 1,
    name,
  })
  const names = (display: LinearMafDisplayModel) =>
    display.framesDataMap.get(0)?.map(f => f.name)

  it('reads the tier on screen first', () => {
    const { display, view } = framesEnv().createDisplay()
    seedSources(display)
    display.setShowAnnotations(true)
    seedSummary(display, view.displayedRegions, [], [frame('wide')])
    seedAlignment(display, undefined, [frame('narrow')])

    view.zoomTo(1)
    expect(display.coarseTierActive).toBe(false)
    expect(names(display)).toEqual(['narrow'])

    view.zoomTo(100)
    expect(display.coarseTierActive).toBe(true)
    expect(names(display)).toEqual(['wide'])
  })

  it('stands in with the other tier where the tier on screen holds none', () => {
    const { display, view } = framesEnv().createDisplay()
    seedSources(display)
    display.setShowAnnotations(true)
    seedAlignment(display, undefined, [frame('narrow')])

    view.zoomTo(100)
    expect(display.coarseTierActive).toBe(true)
    expect(names(display)).toEqual(['narrow'])

    seedSummary(display, view.displayedRegions, [], [frame('wide')])
    expect(names(display)).toEqual(['wide'])

    view.zoomTo(1)
    display.clearAllRpcData()
    expect(display.coarseTierActive).toBe(false)
    expect(names(display)).toEqual(['wide'])
  })
})

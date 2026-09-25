import { autorun } from 'mobx'

import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'
import type { Region } from '@jbrowse/core/util'

function seedRegion(display: LinearMafDisplayModel) {
  display.setSamples({
    samples: [
      { id: 'hg38', label: 'hg38' },
      { id: 'panTro4', label: 'panTro4' },
    ],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  stageDetailRegion(
    display,
    0,
    testWireRegionData(
      [
        {
          startBp: 100,
          refSeq: 'ACGTACGTAC',
          rows: [
            { sampleId: 'hg38', seq: 'ACGTACGTAC', chr: 'chr1' },
            { sampleId: 'panTro4', seq: 'ACGTACGTAC', chr: 'chr1' },
          ],
        },
        {
          startBp: 110,
          refSeq: 'ACG',
          rows: [
            { sampleId: 'hg38', seq: 'ACG', chr: 'chr1' },
            { sampleId: 'panTro4', seq: 'ACG', chr: 'chr7' },
          ],
        },
      ],
      { coverage: emptyMafCoverage(100) },
    ),
  )
}

// The rows' encode is held by the upload's autorun in the app; a test holds it
// the same way, or every read re-encodes.
function observed(display: LinearMafDisplayModel) {
  return autorun(() => {
    void display.encodedUpload
  })
}

function summaryTier() {
  const { display, view } = createMafTestEnvironment({
    summaryAdapter: { type: 'BigBedAdapter' },
  }).createDisplay()
  display.setSamples({
    samples: [
      { id: 'hg38', label: 'hg38' },
      { id: 'mm10', label: 'mm10' },
    ],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  view.zoomTo(100)
  display.setCoarseTier(
    [
      {
        displayedRegionIndex: 0,
        payload: {
          data: [
            { refName: 'ctgA', start: 1000, end: 3000, src: 'hg38', score: 1 },
            { refName: 'ctgA', start: 1000, end: 3000, src: 'mm10', score: 0 },
          ],
          frames: undefined,
        },
      },
    ],
    {
      regions: view.displayedRegions.map(
        (region: Region, displayedRegionIndex: number) => ({
          region,
          displayedRegionIndex,
        }),
      ),
      key: display.coarseTierIssueKey,
    },
  )
  return { display, view }
}

describe('the summary bars are a row mark', () => {
  it('encodes the tier records on a payload with no alignment', () => {
    const { display } = summaryTier()
    expect(display.coarseTierActive).toBe(true)
    const payload = display.encodedUpload.get(0)!
    expect(payload.cells.count).toBe(0)
    expect(payload.summary!.records.map(r => r.src)).toEqual(['hg38', 'mm10'])
  })

  it('hovers the record under the pointer through the mark', () => {
    const { display, view } = summaryTier()
    const [block] = display.renderBlocks
    const x = block!.screenStartPx + (2000 - block!.start) / view.bpPerPx
    expect(display.summaryHoverInfo(1, x)).toMatchObject({ src: 'mm10' })
    expect(display.summaryHoverInfo(0, x)).toMatchObject({ src: 'hg38' })
    expect(display.summaryHoverInfo(1, x + 100)).toBeUndefined()
  })

  it('does not re-encode on a pan', () => {
    const { display, view } = summaryTier()
    const dispose = observed(display)
    const before = display.encodedUpload.get(0)!.summary
    const offsetPx = view.offsetPx
    view.horizontalScroll(5)
    expect(view.offsetPx).not.toBe(offsetPx)
    expect(display.encodedUpload.get(0)!.summary).toBe(before)
    dispose()
  })
})

describe('color by source chromosome is a row mark', () => {
  it('encodes one span per aligned row per block, and no cells', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    display.setRowRendering('chromosome')
    const payload = display.encodedUpload.get(0)!
    expect(payload.cells.count).toBe(0)
    expect(payload.sourceChrom).toMatchObject({ count: 4 })
    expect([...payload.sourceChrom!.x]).toEqual([100, 100, 110, 110])
    expect([...payload.sourceChrom!.row]).toEqual([0, 1, 0, 1])
    expect(payload.identity).toBeUndefined()
    expect(payload.identityBars).toBeUndefined()
  })

  it('encodes nothing for it in the bases rendering', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    const payload = display.encodedUpload.get(0)!
    expect(payload.sourceChrom).toBeUndefined()
    expect(payload.cells.count).toBeGreaterThan(0)
  })

  it('does not re-encode on a pan', () => {
    const { display, view } = createMafTestEnvironment().createDisplay({
      regions: [
        { assemblyName: 'volvox', start: 0, end: 100_000, refName: 'ctgA' },
      ],
    })
    seedRegion(display)
    display.setRowRendering('chromosome')
    const dispose = observed(display)
    const before = display.encodedUpload.get(0)!.sourceChrom
    view.horizontalScroll(500)
    expect(view.offsetPx).toBeGreaterThan(0)
    expect(display.encodedUpload.get(0)!.sourceChrom).toBe(before)
    dispose()
  })
})

describe('identity is a row mark', () => {
  it('encodes the heatmap as cells and no bars', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    display.setRowIdentityAutoZoom(false)
    display.setRowRendering('identity')
    const payload = display.encodedUpload.get(0)!
    expect(payload.cells.count).toBe(0)
    expect(payload.identity!.count).toBeGreaterThan(0)
    expect(payload.identityBars).toBeUndefined()
  })

  it('encodes the X-Y plot as bars, on the ramp only under color identity', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    display.setRowIdentityAutoZoom(false)
    display.setRowRendering('xyplot')
    const flat = display.encodedUpload.get(0)!.identityBars!
    expect(flat.count).toBeGreaterThan(0)
    expect(new Set(flat.color).size).toBe(1)
    expect(display.identityEncoding).toBe('bars')

    display.setColorField('identity')
    expect(display.identityEncoding).toBe('rampBars')
    expect(display.encodedUpload.get(0)!.identity).toBeUndefined()
  })

  it('does not re-encode on a pan', () => {
    const { display, view } = createMafTestEnvironment().createDisplay({
      regions: [
        { assemblyName: 'volvox', start: 0, end: 100_000, refName: 'ctgA' },
      ],
    })
    seedRegion(display)
    display.setRowIdentityAutoZoom(false)
    display.setRowRendering('identity')
    const dispose = observed(display)
    const before = display.encodedUpload.get(0)!.identity
    view.horizontalScroll(500)
    expect(view.offsetPx).toBeGreaterThan(0)
    expect(display.encodedUpload.get(0)!.identity).toBe(before)
    dispose()
  })
})

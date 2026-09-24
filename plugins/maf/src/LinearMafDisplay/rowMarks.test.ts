import { autorun } from 'mobx'

import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

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

describe('color by source chromosome is a row mark', () => {
  it('encodes one span per aligned row per block, and no cells', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    display.setRowRendering('sourceChrom')
    const payload = display.encodedUpload.get(0)!
    expect(payload.cells.count).toBe(0)
    expect(payload.sourceChrom).toMatchObject({ count: 4 })
    expect([...payload.sourceChrom!.x]).toEqual([100, 100, 110, 110])
    expect([...payload.sourceChrom!.row]).toEqual([0, 1, 0, 1])
    expect(display.rowsCanvas2dMode).toBeUndefined()
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
    display.setRowRendering('sourceChrom')
    const dispose = observed(display)
    const before = display.encodedUpload.get(0)!.sourceChrom
    view.horizontalScroll(500)
    expect(view.offsetPx).toBeGreaterThan(0)
    expect(display.encodedUpload.get(0)!.sourceChrom).toBe(before)
    dispose()
  })
})

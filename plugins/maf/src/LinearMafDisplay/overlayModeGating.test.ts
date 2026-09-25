import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

// One block with a reference-gap column, so `blockHasRefGap` lets the insertion
// walk in and both rows emit a marker.
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
          // ref has a `-` at column 3 → an insertion column
          refSeq: 'ACG-T',
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

// The insertion markers are drawn only by the `bases` rendering — the overlay
// and the SVG export both gate on `basesRenderingActive` — so computing them in
// any other mode is a full per-column walk of every visible block x row, per
// frame, thrown away. The identity plot is the case that matters: it is the
// zoom-out default once `rowIdentityMode` is set, which is where the walk
// covers the most blocks. See agent-docs/reference/MAF_LARGE_BLOCKS.md.
describe('insertion markers are only computed for the rendering that draws them', () => {
  it('emits markers in bases mode', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    expect(display.activeRowRendering).toBe('mismatch')
    expect(display.visibleInsertions.length).toBeGreaterThan(0)
  })

  it('emits none while the per-row identity plot owns the rows', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    // auto-zoom off pins the identity plot on at this zoom
    display.setRowIdentityAutoZoom(false)
    display.setRowRendering('identity')
    expect(display.activeRowRendering).toBe('identity')
    expect(display.visibleInsertions).toEqual([])
  })

  it('emits none while color-by-source-chromosome owns the rows', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    display.setRowRendering('chromosome')
    expect(display.activeRowRendering).toBe('chromosome')
    expect(display.visibleInsertions).toEqual([])
  })

  it('draws deletion counts with the bases alone', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setSamples({
      samples: [{ id: 'hg38', label: 'hg38' }],
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
            refSeq: 'ACGTACGT',
            rows: [{ sampleId: 'hg38', seq: 'A----CGT' }],
          },
        ],
        { coverage: emptyMafCoverage(100) },
      ),
    )
    display.view.zoomTo(0.05)
    display.view.centerAt(104, 'ctgA')
    expect(display.visibleDeletions.map(d => d.length)).toEqual([4])
    display.setRowRendering('chromosome')
    expect(display.visibleDeletions).toEqual([])
  })
})

describe('the hover names an insertion only where its marker draws', () => {
  const atAnchor = (display: LinearMafDisplayModel) =>
    display.rowHoverInfo(0, { gposFrac: 103, baseBp: 103 }, 0, 0.1)?.kind

  it('names the insertion under the bases', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    expect(atAnchor(display)).toBe('insertion')
  })

  it('names the base under the identity plot', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    display.setRowIdentityAutoZoom(false)
    display.setRowRendering('identity')
    expect(atAnchor(display)).toBe('cell')
  })
})

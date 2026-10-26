import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/mafWire.fixture.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import {
  createMafTestEnvironment,
  stageDetailRegion,
  zoomPastBaseLevel,
} from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

// One block with a reference-gap column, so `blockHasRefGap` lets the insertion
// walk in and both rows emit a marker.
function seedRegion(display: LinearMafDisplayModel) {
  display.setSamples({
    samples: [
      { name: 'hg38', label: 'hg38' },
      { name: 'panTro4', label: 'panTro4' },
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

// The insertion markers belong to the mismatches layer, as alignments'
// `pileup.mismatches` draws its insertion markers, so encoding them while it is
// off is a walk of every block x row thrown away. See
// agent-docs/reference/MAF_LARGE_BLOCKS.md.
const insertionsOf = (display: LinearMafDisplayModel) =>
  display.encodedUpload.get(0)?.insertions?.count ?? 0

describe('insertion markers are only encoded while a layer draws them', () => {
  it('emits markers under the mismatches', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    expect(display.rowPlan.perBase).toBe(true)
    expect(insertionsOf(display)).toBe(2)
  })

  it('emits them over a field fill, since the mismatches draw there too', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    zoomPastBaseLevel(display.view)
    display.colorByField('identity')
    expect(insertionsOf(display)).toBe(2)
  })

  it('emits none with the mismatches off', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    zoomPastBaseLevel(display.view)
    display.colorByField('identity')
    display.setShowMismatches(false)
    expect(display.rowPlan.perBase).toBe(false)
    expect(insertionsOf(display)).toBe(0)
  })

  it('draws deletion counts with the mismatches alone', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setSamples({
      samples: [{ name: 'hg38', label: 'hg38' }],
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
    display.setShowMismatches(false)
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

  it('names the base with the mismatches off', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    zoomPastBaseLevel(display.view)
    display.colorByField('identity')
    display.setShowMismatches(false)
    expect(atAnchor(display)).toBe('cell')
  })
})

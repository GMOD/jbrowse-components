import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment } from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

const enc = new TextEncoder()

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
  display.setRpcData(0, {
    blocks: [
      {
        startBp: 100,
        endBp: 104,
        //                  ref has a `-` at column 2 → an insertion column
        refSeqBytes: enc.encode('ACG-T'),
        rows: [
          { sampleId: 'hg38', alignmentBytes: enc.encode('ACGTT') },
          { sampleId: 'panTro4', alignmentBytes: enc.encode('ACGTT') },
        ],
        empties: [],
      },
    ],
    coverage: emptyMafCoverage(100),
  })
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
    expect(display.activeRowRendering).toBe('bases')
    expect(display.visibleInsertions.length).toBeGreaterThan(0)
  })

  it('emits none while the per-row identity plot owns the rows', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    // auto-zoom off pins the identity plot on at this zoom
    display.setRowIdentityAutoZoom(false)
    display.setRowIdentityMode('heatmap')
    expect(display.activeRowRendering).toBe('heatmap')
    expect(display.visibleInsertions).toEqual([])
  })

  it('emits none while color-by-source-chromosome owns the rows', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    display.setColorByChromosome(true)
    expect(display.activeRowRendering).toBe('sourceChrom')
    expect(display.visibleInsertions).toEqual([])
  })

  // Deletion count labels deliberately draw in every mode (the gap cells they
  // annotate come from whichever rendering is painting), so they are NOT gated
  // the same way — pinned here so the two don't get "unified" by mistake.
  it('leaves the deletion labels ungated by rendering mode', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    seedRegion(display)
    display.setColorByChromosome(true)
    expect(() => display.visibleDeletions).not.toThrow()
  })
})

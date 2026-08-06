import { createMafTestEnvironment } from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

// The two stacked bands are filled histograms told apart only by their Y-axis
// units (depth vs %), which is why they are titled at all — and why the titles
// have to reach the SVG export, where nothing can be hovered. `bandLabels` is
// the one source the on-screen labels and the export both read.
describe('band titles', () => {
  // Through the setters, not `displaySnapshot`: these are config slots, and a
  // display snapshot carries properties — a slot spelled there is dropped.
  function display(annotationAdapter?: unknown) {
    return createMafTestEnvironment({ annotationAdapter }).createDisplay()
      .display
  }
  function withSamples(d: LinearMafDisplayModel) {
    d.setSamples({
      samples: [{ id: 'hg38', label: 'hg38' }],
      treeNewick: undefined,
      samplesCanonical: true,
    })
    return d
  }

  it('titles both bands when both draw', () => {
    const d = display()
    d.setShowConservation(true)
    expect(d.bandLabels).toEqual([
      { text: 'Coverage', top: 0 },
      { text: 'Conservation (% identity)', top: d.coverageDisplayHeight },
    ])
  })

  it('titles nothing when only one band draws', () => {
    const d = display()
    // conservation off — the coverage band is unambiguous on its own
    expect(d.bandLabels).toEqual([])
    d.setShowConservation(true)
    d.setShowCoverage(false)
    expect(d.bandLabels).toEqual([])
  })

  // Codon mode falls back to per-base wherever frames or per-base blocks are
  // missing, so the title has to follow what is drawn, not what was asked for.
  it('names per-base identity when codon mode has no frames to draw from', () => {
    const d = display()
    d.setShowConservation(true)
    d.setConservationMode('codon')
    expect(d.codonConservationActive).toBe(false)
    expect(d.bandLabels[1]!.text).toBe('Conservation (% identity)')
  })

  it('names amino-acid identity once the codon band can draw', () => {
    const d = withSamples(display({}))
    d.setShowConservation(true)
    d.setConservationMode('codon')
    expect(d.codonConservationActive).toBe(true)
    expect(d.bandLabels[1]!.text).toBe('Conservation (aa identity)')
  })
})

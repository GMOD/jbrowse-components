import StateEncoder from '../RLPipeline/StateEncoder.ts'

function makeMockView(overrides: Record<string, unknown> = {}) {
  return {
    bpPerPx: 1,
    offsetPx: 0,
    width: 800,
    displayedRegions: [
      { assemblyName: 'hg38', refName: 'chr1', start: 0, end: 1000 },
    ],
    tracks: [],
    dynamicBlocks: { contentBlocks: [] },
    ...overrides,
  }
}

describe('StateEncoder', () => {
  it('extractState returns expected shape', () => {
    const encoder = new StateEncoder()
    const state = encoder.extractState(makeMockView(), 0, 0)

    expect(state).toHaveProperty('bpPerPx', 1)
    expect(state).toHaveProperty('refName', 'chr1')
    expect(state).toHaveProperty('assemblyName', 'hg38')
    expect(state).toHaveProperty('zoomLevel')
    expect(state).toHaveProperty('activeTracks')
    expect(state).toHaveProperty('numTracks', 0)
    expect(state).toHaveProperty('openWidgets')
    expect(state).toHaveProperty('viewportCenterBp')
    expect(state).toHaveProperty('labelsVisible')
  })

  it('zoomLevel classification is correct', () => {
    const encoder = new StateEncoder()
    const cases: [number, string][] = [
      [500, 'genome'],
      [50, 'region'],
      [5, 'gene'],
      [0.5, 'sequence'],
      [0.05, 'basepair'],
    ]
    for (const [bpPerPx, expected] of cases) {
      const state = encoder.extractState(makeMockView({ bpPerPx }), 0, 0)
      expect(state.zoomLevel).toBe(expected)
    }
  })

  it('labelsVisible true when bpPerPx < 10', () => {
    const encoder = new StateEncoder()
    expect(encoder.extractState(makeMockView({ bpPerPx: 5 }), 0, 0).labelsVisible).toBe(true)
    expect(encoder.extractState(makeMockView({ bpPerPx: 50 }), 0, 0).labelsVisible).toBe(false)
  })

  it('categorizes track types into boolean flags', () => {
    const encoder = new StateEncoder()
    const tracks = [
      { configuration: 'ref1', type: 'ReferenceSequenceTrack', displays: [] },
      { configuration: 'genes1', type: 'FeatureTrack', displays: [] },
      { configuration: 'aln1', type: 'AlignmentsTrack', displays: [] },
      { configuration: 'vcf1', type: 'VariantTrack', displays: [] },
      { configuration: 'bw1', type: 'QuantitativeTrack', displays: [] },
    ]
    const state = encoder.extractState(makeMockView({ tracks }), 0, 0)
    expect(state.hasReferenceSequence).toBe(true)
    expect(state.hasGeneTrack).toBe(true)
    expect(state.hasAlignmentTrack).toBe(true)
    expect(state.hasVariantTrack).toBe(true)
    expect(state.hasQuantitativeTrack).toBe(true)
    expect(state.numTracks).toBe(5)
  })

  it('encode() returns a fixed-size numeric vector', () => {
    const encoder = new StateEncoder()
    const state = encoder.extractState(makeMockView(), 0, 0)
    const vec = encoder.encode(state)
    expect(vec).toHaveLength(encoder.dimensions)
    expect(vec.length).toBe(21)
    for (const v of vec) {
      expect(typeof v).toBe('number')
      expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('recordAction increments action counts', () => {
    const encoder = new StateEncoder()
    encoder.recordAction('ZOOM')
    encoder.recordAction('ZOOM')
    encoder.recordAction('PAN')
    const state = encoder.extractState(makeMockView(), 0, 0)
    expect(state.actionCountsByType.ZOOM).toBe(2)
    expect(state.actionCountsByType.PAN).toBe(1)
    expect(state.totalActionsThisSession).toBe(3)
  })

  it('tracks unique refNames visited', () => {
    const encoder = new StateEncoder()
    encoder.extractState(makeMockView({ displayedRegions: [{ refName: 'chr1', start: 0, end: 100 }] }), 0, 0)
    encoder.extractState(makeMockView({ displayedRegions: [{ refName: 'chr2', start: 0, end: 100 }] }), 0, 0)
    encoder.extractState(makeMockView({ displayedRegions: [{ refName: 'chr1', start: 0, end: 100 }] }), 0, 0)
    const state = encoder.extractState(makeMockView({ displayedRegions: [{ refName: 'chr3', start: 0, end: 100 }] }), 0, 0)
    expect(state.uniqueRefNamesVisited).toEqual(
      expect.arrayContaining(['chr1', 'chr2', 'chr3']),
    )
    expect(state.uniqueRefNamesVisited).toHaveLength(3)
  })

  it('handles view with throwing getters gracefully', () => {
    const encoder = new StateEncoder()
    const throwingView = {
      get bpPerPx() {
        throw new Error('not initialized')
      },
      displayedRegions: [],
      tracks: [],
    }
    // Should not throw
    expect(() => encoder.extractState(throwingView, 0, 0)).not.toThrow()
  })
})

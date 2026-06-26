import { buildDisplaySnapshot } from './applyTrackOpts.ts'

// buildDisplaySnapshot turns a track's modifier list into a declarative display
// snapshot (passed to showTrack), instead of a sequence of setter actions.

describe('alignments modifiers', () => {
  test('group:type:tag sets a groupBy object', () => {
    const { snap } = buildDisplaySnapshot('alignments', ['group:tag:HP'])
    expect(snap.groupBy).toEqual({ type: 'tag', tag: 'HP' })
  })

  test('color sets colorBy', () => {
    const { snap } = buildDisplaySnapshot('alignments', ['color:tag:XS'])
    expect(snap.colorBy).toEqual({ type: 'tag', tag: 'XS' })
  })

  test('height parses a number', () => {
    const { snap } = buildDisplaySnapshot('alignments', ['height:400'])
    expect(snap.height).toBe(400)
  })

  test('arcs:samplot and arcs:down map to readConnections fields', () => {
    expect(
      buildDisplaySnapshot('alignments', ['arcs:samplot']).snap,
    ).toMatchObject({ readConnections: 'samplot' })
    expect(
      buildDisplaySnapshot('alignments', ['arcs:down']).snap,
    ).toMatchObject({ readConnections: 'arc', readConnectionsDown: true })
  })

  test('linkedReads:bezier is the showBezierConnections overlay, not a layout mode', () => {
    const { snap } = buildDisplaySnapshot('alignments', ['linkedReads:bezier'])
    expect(snap.showBezierConnections).toBe(true)
    expect(snap.linkedReads).toBeUndefined()
  })

  test('sashimi:off hides arcs; sashimi:down sets mode', () => {
    expect(
      buildDisplaySnapshot('alignments', ['sashimi:off']).snap,
    ).toMatchObject({ showSashimiArcs: false })
    expect(
      buildDisplaySnapshot('alignments', ['sashimi:down']).snap,
    ).toMatchObject({ showSashimiArcs: true, sashimiArcsMode: 'down' })
  })

  test('sort is returned as an intent (resolved against the view)', () => {
    const { sort, snap } = buildDisplaySnapshot('alignments', ['sort:base'])
    expect(sort).toEqual({ type: 'base', tag: undefined })
    expect(snap.sortedBy).toBeUndefined()
  })

  test('force is returned as a flag (volatile, not a snapshot value)', () => {
    expect(buildDisplaySnapshot('alignments', ['force:true']).force).toBe(true)
    expect(buildDisplaySnapshot('alignments', []).force).toBe(false)
  })

  test('featureHeight preset maps to per-read height/spacing', () => {
    const { snap } = buildDisplaySnapshot('alignments', [
      'featureHeight:super-compact',
    ])
    expect(snap).toMatchObject({ featureHeight: 1, featureSpacing: 0 })
  })

  test('featureHeight numeric sets featureHeight', () => {
    expect(
      buildDisplaySnapshot('alignments', ['featureHeight:4']).snap
        .featureHeight,
    ).toBe(4)
  })

  test('featureHeight rejects a non-numeric, non-preset value', () => {
    expect(() =>
      buildDisplaySnapshot('alignments', ['featureHeight:bogus']),
    ).toThrow(/Invalid featureHeight/)
  })

  test('snpcov hides the pileup and fills coverage to the given height', () => {
    const { snap } = buildDisplaySnapshot('alignments', [
      'snpcov',
      'height:200',
    ])
    expect(snap).toMatchObject({
      showPileup: false,
      showCoverage: true,
      coverageHeight: 200,
    })
  })
})

describe('feature modifiers', () => {
  test('featureHeight preset maps to displayMode for canvas features', () => {
    const { snap } = buildDisplaySnapshot('feature', [
      'featureHeight:super-compact',
    ])
    expect(snap.displayMode).toBe('superCompact')
  })

  test('alignment-only modifiers are ignored on a feature track', () => {
    const { snap } = buildDisplaySnapshot('feature', [
      'arcs:up',
      'sashimi:down',
    ])
    expect(snap.readConnections).toBeUndefined()
    expect(snap.showSashimiArcs).toBeUndefined()
  })
})

describe('wiggle / score modifiers', () => {
  test('score settings accumulate into the snapshot', () => {
    const { snap } = buildDisplaySnapshot('wiggle', [
      'scaletype:log',
      'fill:false',
      'minmax:1:1024',
      'crosshatch:true',
      'resolution:superfine',
      'color:purple',
    ])
    expect(snap).toMatchObject({
      scaleType: 'log',
      defaultRendering: 'scatter',
      minScore: 1,
      maxScore: 1024,
      displayCrossHatches: true,
      resolution: 100,
      color: 'purple',
      useBicolor: false,
    })
  })

  test('score settings are ignored on a non-score (alignments) track', () => {
    const { snap } = buildDisplaySnapshot('alignments', [
      'scaletype:log',
      'fill:false',
    ])
    expect(snap.scaleType).toBeUndefined()
    expect(snap.defaultRendering).toBeUndefined()
  })
})

test('a {...} token is merged as raw JSON', () => {
  const { snap } = buildDisplaySnapshot('alignments', [
    '{"colorBy":{"type":"strand"}}',
  ])
  expect(snap.colorBy).toEqual({ type: 'strand' })
})

test('unknown modifier warns and does nothing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  buildDisplaySnapshot('alignments', ['colour:red'])
  expect(warn).toHaveBeenCalledWith('Warning: unknown track option "colour"')
  warn.mockRestore()
})

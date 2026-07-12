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

  test('a non-numeric height rejects instead of writing NaN', () => {
    expect(() => buildDisplaySnapshot('alignments', ['height:8o'])).toThrow(
      /Invalid height/,
    )
    expect(() =>
      buildDisplaySnapshot('alignments', ['coverageHeight:x']),
    ).toThrow(/Invalid coverageHeight/)
  })

  test('a non-numeric minmax bound rejects', () => {
    expect(() => buildDisplaySnapshot('wiggle', ['minmax:lo:100'])).toThrow(
      /Invalid minmax/,
    )
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

  test('heightMode sets each track-height strategy', () => {
    expect(
      buildDisplaySnapshot('feature', ['heightMode:fit']).snap.heightMode,
    ).toBe('fit')
    expect(
      buildDisplaySnapshot('feature', ['heightMode:grow']).snap.heightMode,
    ).toBe('grow')
    expect(
      buildDisplaySnapshot('feature', ['heightMode:fixed']).snap.heightMode,
    ).toBe('fixed')
    expect(buildDisplaySnapshot('feature', []).snap.heightMode).toBeUndefined()
  })

  test('heightMode:mode:N sets both the strategy and the track height', () => {
    const { snap } = buildDisplaySnapshot('feature', ['heightMode:fit:200'])
    expect(snap.height).toBe(200)
    expect(snap.heightMode).toBe('fit')
  })

  test('an unknown heightMode is ignored', () => {
    expect(
      buildDisplaySnapshot('feature', ['heightMode:bogus']).snap.heightMode,
    ).toBeUndefined()
  })

  test('alignments heightMode shares the full fixed/grow/fit vocabulary', () => {
    expect(
      buildDisplaySnapshot('alignments', ['heightMode:fit']).snap.heightMode,
    ).toBe('fit')
    expect(
      buildDisplaySnapshot('alignments', ['heightMode:grow']).snap.heightMode,
    ).toBe('grow')
    expect(
      buildDisplaySnapshot('alignments', ['heightMode:fixed']).snap.heightMode,
    ).toBe('fixed')
  })

  test('heightMode is ignored on a display type without the notion', () => {
    expect(
      buildDisplaySnapshot('wiggle', ['heightMode:fixed']).snap.heightMode,
    ).toBeUndefined()
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

describe('display type selection', () => {
  test('display:multivariant aliases to the multi-sample display', () => {
    expect(
      buildDisplaySnapshot('variant', ['display:multivariant']).displayType,
    ).toBe('LinearMultiSampleVariantDisplay')
  })

  test('display:multivariantmatrix aliases to the matrix display', () => {
    expect(
      buildDisplaySnapshot('variant', ['display:multivariantmatrix'])
        .displayType,
    ).toBe('LinearMultiSampleVariantMatrixDisplay')
  })

  test('an unknown display value passes through verbatim', () => {
    expect(
      buildDisplaySnapshot('variant', ['display:SomeOtherDisplay']).displayType,
    ).toBe('SomeOtherDisplay')
  })

  test('no display modifier leaves displayType undefined (track default)', () => {
    expect(buildDisplaySnapshot('variant', []).displayType).toBeUndefined()
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

// `index:` is consumed at config-build time (readData) but still rides in a
// track's modifier list, so it must be a recognized no-op here rather than
// warning like a typo.
test('index: is a recognized no-op, not an unknown-option warning', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const { snap } = buildDisplaySnapshot('feature', [
    'index:https://x/y.bed.gz.csi',
    'height:100',
  ])
  expect(snap).toEqual({ height: 100 })
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

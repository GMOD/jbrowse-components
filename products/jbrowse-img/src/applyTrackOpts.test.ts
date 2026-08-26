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

  test('arcs:cloud and arcs:down map to readConnections fields', () => {
    expect(
      buildDisplaySnapshot('alignments', ['arcs:cloud']).snap,
    ).toMatchObject({ readConnections: 'cloud' })
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
    // `base` normalizes to the layout's `basePair` key so the sort isn't a
    // silent no-op (the layout only recognizes `basePair`)
    expect(sort).toEqual({ type: 'basePair', tag: undefined })
    expect(snap.sortedBy).toBeUndefined()
  })

  test('sort:basePair passes through unchanged', () => {
    const { sort } = buildDisplaySnapshot('alignments', ['sort:strand'])
    expect(sort).toEqual({ type: 'strand', tag: undefined })
  })

  test('force sets the declarative forceLoad config slot', () => {
    expect(buildDisplaySnapshot('alignments', ['force:true']).snap).toEqual({
      forceLoad: true,
    })
    expect(
      buildDisplaySnapshot('alignments', []).snap.forceLoad,
    ).toBeUndefined()
  })

  test('featureHeight preset maps to per-read height (spacing is derived)', () => {
    const { snap } = buildDisplaySnapshot('alignments', [
      'featureHeight:super-compact',
    ])
    expect(snap).toMatchObject({ featureHeight: 1 })
    expect(snap).not.toHaveProperty('featureSpacing')
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

  // A modifier aimed at the wrong track type used to be dropped in silence, so
  // `--gffgz genes.gff.gz sashimi:down` looked like it had worked.
  test('alignment-only modifiers warn on a feature track', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { snap } = buildDisplaySnapshot('feature', [
      'arcs:up',
      'sashimi:down',
    ])
    expect(snap.readConnections).toBeUndefined()
    expect(snap.showSashimiArcs).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      'Warning: track option "arcs" has no effect on a feature track (applies to: alignments)',
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"sashimi" has no effect on a feature track'),
    )
    warn.mockRestore()
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

  test('an unknown heightMode rejects', () => {
    expect(() => buildDisplaySnapshot('feature', ['heightMode:bogus'])).toThrow(
      /Invalid heightMode value "bogus". Expected fixed, grow, fit./,
    )
  })

  // heightMode's optional second arg used to swallow a typo (`Number.isFinite`
  // guard), silently rendering at the default height
  test('a non-numeric heightMode height rejects', () => {
    expect(() =>
      buildDisplaySnapshot('feature', ['heightMode:fit:20o']),
    ).toThrow(/Invalid heightMode/)
  })

  // feature and variant displays extend the same LinearCanvasBaseDisplay, so
  // every modifier that reads one of its slots must accept both
  test('the canvas-base modifiers apply to feature and variant alike', () => {
    for (const category of ['feature', 'variant'] as const) {
      expect(
        buildDisplaySnapshot(category, ['heightMode:grow']).snap.heightMode,
      ).toBe('grow')
      expect(
        buildDisplaySnapshot(category, ['featureHeight:compact']).snap
          .displayMode,
      ).toBe('compact')
    }
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
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(
      buildDisplaySnapshot('wiggle', ['heightMode:fixed']).snap.heightMode,
    ).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"heightMode" has no effect on a wiggle track'),
    )
    warn.mockRestore()
  })
})

describe('alignments settings a static export cannot reach any other way', () => {
  test('the display-chrome and sashimi numbers accumulate', () => {
    const { snap } = buildDisplaySnapshot('alignments', [
      'legend',
      'maxHeight:4000',
      'sashimiScore:3',
      'sashimiHeight:120',
      'arcColor:insertSize',
    ])
    expect(snap).toMatchObject({
      showLegend: true,
      maxHeight: 4000,
      minSashimiScore: 3,
      sashimiArcsHeight: 120,
      arcColorByType: 'insertSize',
    })
  })

  test('legend reads as a flag, like coverage and force', () => {
    expect(
      buildDisplaySnapshot('alignments', ['legend:false']).snap.showLegend,
    ).toBe(false)
  })

  // The SV export: the split reads of the pairs the aligner did not call
  // concordant. Both halves land in one `filterBy`, so they compose with the
  // flag masks and tag filters below rather than sitting beside them.
  test('the read categories fold into filterBy', () => {
    expect(
      buildDisplaySnapshot('alignments', ['properPairs:exclude', 'split:only'])
        .snap.filterBy,
    ).toEqual({ properPairs: 'exclude', split: 'only' })
  })

  // `all` is the absent filter, so it stores nothing — which is what lets a
  // script pass a category through from a variable that may be empty.
  test('a category set to all stores nothing', () => {
    expect(
      buildDisplaySnapshot('alignments', ['singletons:all']).snap.filterBy,
    ).toEqual({})
  })

  test('an unknown category value names the three that work', () => {
    expect(() => buildDisplaySnapshot('alignments', ['spliced:true'])).toThrow(
      /all, only, exclude/,
    )
  })

  // samtools' -f / -F, in that order
  test('flags sets the two masks', () => {
    expect(
      buildDisplaySnapshot('alignments', ['flags:2:1540']).snap.filterBy,
    ).toEqual({ flagInclude: 2, flagExclude: 1540 })
  })

  // An omitted half has to leave the display's own default alone rather than
  // become 0 -- `flags::256` reading as "include nothing" would silently drop
  // every read.
  test('an omitted half of flags is left unset', () => {
    expect(
      buildDisplaySnapshot('alignments', ['flags::256']).snap.filterBy,
    ).toEqual({ flagExclude: 256 })
    expect(
      buildDisplaySnapshot('alignments', ['flags:2']).snap.filterBy,
    ).toEqual({ flagInclude: 2 })
  })

  // The names carry their own arithmetic, so a reader who wants "drop secondary
  // as well" writes that rather than working out that 1540 becomes 1796.
  test('flags takes samtools flag names as well as numbers', () => {
    expect(
      buildDisplaySnapshot('alignments', ['flags::SECONDARY,DUP']).snap
        .filterBy,
    ).toEqual({ flagExclude: 256 | 1024 })
    expect(
      buildDisplaySnapshot('alignments', ['flags:proper_pair']).snap.filterBy,
    ).toEqual({ flagInclude: 2 })
    // The display's own default mask, said both ways — and the pair below is
    // the reason the names are worth having: 1540 and 1796 differ by one bit
    // nobody reads off the number.
    expect(
      buildDisplaySnapshot('alignments', ['flags::UNMAP,QCFAIL,DUP']).snap
        .filterBy,
    ).toEqual(buildDisplaySnapshot('alignments', ['flags::1540']).snap.filterBy)
    expect(
      buildDisplaySnapshot('alignments', ['flags::UNMAP,SECONDARY,QCFAIL,DUP'])
        .snap.filterBy,
    ).toEqual(buildDisplaySnapshot('alignments', ['flags::1796']).snap.filterBy)
  })

  test('an unknown flag name lists the vocabulary', () => {
    expect(() =>
      buildDisplaySnapshot('alignments', ['flags::SECONDRY']),
    ).toThrow(/PAIRED, PROPER_PAIR/)
  })

  // AND-ed, so a second one is a second condition rather than a replacement
  test('tag filters accumulate, and coexist with the flag masks', () => {
    expect(
      buildDisplaySnapshot('alignments', [
        'flags:2',
        'filterTag:HP:1',
        'filterTag:RG:lane3',
      ]).snap.filterBy,
    ).toEqual({
      flagInclude: 2,
      tagFilters: [
        { tag: 'HP', value: '1' },
        { tag: 'RG', value: 'lane3' },
      ],
    })
  })

  test('the new alignments modifiers warn on a wiggle track', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { snap } = buildDisplaySnapshot('wiggle', ['legend', 'flags:2:1540'])
    expect(snap.showLegend).toBeUndefined()
    expect(snap.filterBy).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
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
    })
    // a bare `color` is left for the wiggle display config's own
    // colorImpliesSolid preProcessSnapshot to turn bicolor off
    expect(snap.useBicolor).toBeUndefined()
  })

  // The coverage-band axis is the same four slots under the same names, so these
  // three apply to alignments too. The rest of the score group is genuinely
  // wiggle-only and still warns.
  test('the axis trio reaches an alignments coverage band', () => {
    const { snap } = buildDisplaySnapshot('alignments', [
      'scaletype:log',
      'autoscale:localsd',
      'minmax:1:4000',
    ])
    expect(snap).toMatchObject({
      scaleType: 'log',
      autoscale: 'localsd',
      minScore: 1,
      maxScore: 4000,
    })
  })

  test('the drawing settings still warn and are ignored on an alignments track', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { snap } = buildDisplaySnapshot('alignments', [
      'fill:false',
      'crosshatch:true',
    ])
    expect(snap.defaultRendering).toBeUndefined()
    expect(snap.displayCrossHatches).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  // `resolution:bogus` used to fall back to 1 silently, which reads as a
  // deliberate coarse render rather than the typo it is
  test('a non-numeric resolution rejects', () => {
    expect(() => buildDisplaySnapshot('wiggle', ['resolution:x'])).toThrow(
      /Invalid resolution/,
    )
  })
})

// The canvas feature display has no `colorBy` (its color slot is a plain CSS
// color/jexl string), and the multi-sample variant displays' `colorBy` is a
// sample-attribute string, not a {type, tag} object — so the object this used to
// write was dropped as an unknown MST key or rejected as a bad slot value.
describe('color routing', () => {
  test('color sets colorBy on alignments and a solid color on wiggle', () => {
    expect(buildDisplaySnapshot('alignments', ['color:strand']).snap).toEqual({
      colorBy: { type: 'strand', tag: undefined },
    })
    expect(buildDisplaySnapshot('wiggle', ['color:purple']).snap).toEqual({
      color: 'purple',
    })
  })

  // The canvas displays take a CSS color or a jexl in the same `color` slot the
  // wiggle display uses — never a colorBy object, which is what used to be
  // written for them and dropped as an unknown MST key.
  test('color sets a solid color on the canvas-based displays', () => {
    for (const category of ['feature', 'variant'] as const) {
      const { snap } = buildDisplaySnapshot(category, ['color:red'])
      expect(snap).toEqual({ color: 'red' })
      expect(snap.colorBy).toBeUndefined()
    }
  })

  // `colorByMode` reports 'strand' only for this exact jexl, so a near-miss
  // would render as an opaque per-feature expression and read back as
  // "color by attribute"
  test('color:strand means strand on the canvas displays too, via the jexl they recognize', () => {
    for (const category of ['feature', 'variant'] as const) {
      const { snap } = buildDisplaySnapshot(category, ['color:strand'])
      expect(snap.color).toBe(
        "jexl:feature.strand==1?'tomato':feature.strand==-1?'cornflowerblue':'goldenrod'",
      )
    }
    // wiggle has no strand notion — 'strand' stays a literal color there
    expect(buildDisplaySnapshot('wiggle', ['color:strand']).snap.color).toBe(
      'strand',
    )
  })

  // the canvas analogue of alignments' `color:tag:X`: color by a per-feature
  // value rather than a fixed scheme. `colorByAttribute` reads the name back out
  // of this expression, so the shape has to be the one the display writes.
  test('color:attribute:<name> builds the per-attribute expression', () => {
    for (const category of ['feature', 'variant'] as const) {
      const { snap } = buildDisplaySnapshot(category, [
        'color:attribute:gene_biotype',
      ])
      expect(snap.color).toBe("jexl:randomColor(get(feature,'gene_biotype'))")
    }
  })

  test('color:attribute with no attribute name rejects', () => {
    expect(() => buildDisplaySnapshot('feature', ['color:attribute'])).toThrow(
      /Missing color:attribute value/,
    )
  })

  test('color warns on a hic track, which has no color slot of either kind', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { snap } = buildDisplaySnapshot('hic', ['color:red'])
    expect(snap.color).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"color" has no effect on a hic track'),
    )
    warn.mockRestore()
  })
})

// One rule for every modifier value, whatever the track type: a value the
// modifier can't use is an error. jb2export writes a figure and exits, so a
// warning scrolls past and leaves a wrong image behind.
describe('modifier values are validated the same way everywhere', () => {
  test.each([
    ['alignments', 'height:', /Missing height/],
    ['alignments', 'height:8o', /Invalid height/],
    ['alignments', 'color:', /Missing color/],
    ['alignments', 'group:', /Missing group/],
    ['alignments', 'sort:', /Missing sort/],
    // a bare `arcs` used to mean OFF, the opposite of every other bare modifier
    ['alignments', 'arcs', /Missing arcs/],
    ['alignments', 'arcs:upp', /Invalid arcs value "upp"/],
    ['alignments', 'sashimi:downn', /Invalid sashimi/],
    ['alignments', 'linkedReads:bezierr', /Invalid linkedReads/],
    ['alignments', 'coverage:ture', /Invalid coverage value "ture"/],
    ['alignments', 'softClipping:0', /Invalid softClipping/],
    ['alignments', 'featureHeight:bogus', /Invalid featureHeight/],
    ['alignments', 'coverageHeight:x', /Invalid coverageHeight/],
    ['feature', 'heightMode:bogus', /Invalid heightMode/],
    ['variant', 'display:', /Missing display/],
    ['wiggle', 'autoscale:', /Missing autoscale/],
    ['wiggle', 'scaletype:', /Missing scaletype/],
    ['wiggle', 'minmax:lo:100', /Invalid minmax/],
    ['wiggle', 'crosshatch:maybe', /Invalid crosshatch/],
    ['wiggle', 'fill:1', /Invalid fill/],
    ['wiggle', 'resolution:x', /Invalid resolution/],
  ] as const)('%s track: %s rejects', (category, opt, message) => {
    expect(() => buildDisplaySnapshot(category, [opt])).toThrow(message)
  })

  // the flag-like modifiers stay flag-like: bare or :true is on, :false is off
  test.each([
    ['coverage', 'showCoverage'],
    ['softClipping', 'showSoftClipping'],
    ['force', 'forceLoad'],
  ] as const)('%s reads as a flag', (opt, key) => {
    expect(buildDisplaySnapshot('alignments', [opt]).snap[key]).toBe(true)
    expect(buildDisplaySnapshot('alignments', [`${opt}:true`]).snap[key]).toBe(
      true,
    )
    expect(buildDisplaySnapshot('alignments', [`${opt}:false`]).snap[key]).toBe(
      false,
    )
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

// The modifier table is keyed by raw CLI input, so a name inherited from
// Object.prototype read as a known modifier and died on its undefined `on` list
test('an Object.prototype key is an unknown modifier, not a crash', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  for (const name of ['constructor', 'toString', 'hasOwnProperty']) {
    expect(buildDisplaySnapshot('alignments', [`${name}:x`]).snap).toEqual({})
    expect(warn).toHaveBeenCalledWith(`Warning: unknown track option "${name}"`)
  }
  // the alias tables are keyed the same way
  expect(
    buildDisplaySnapshot('variant', ['display:constructor']).displayType,
  ).toBe('constructor')
  expect(buildDisplaySnapshot('alignments', ['sort:constructor']).sort).toEqual(
    { type: 'constructor', tag: undefined },
  )
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

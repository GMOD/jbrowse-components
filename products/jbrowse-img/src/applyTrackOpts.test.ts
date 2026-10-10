import { buildDisplaySnapshot } from './applyTrackOpts.ts'

// buildDisplaySnapshot turns a track's modifier list into a declarative display
// snapshot (passed to showTrack), instead of a sequence of setter actions.

describe('alignments modifiers', () => {
  test('a facet or color field is the slot write the display spells', () => {
    expect(buildDisplaySnapshot('alignments', ['facet=tags.HP']).snap).toEqual({
      facet: 'tags.HP',
    })
  })

  test('color:tag and color:attribute point at color.field', () => {
    expect(() => buildDisplaySnapshot('alignments', ['color:tag:XS'])).toThrow(
      /color\.field=tags\.<TAG>/,
    )
    expect(() =>
      buildDisplaySnapshot('feature', ['color:attribute:gene_biotype']),
    ).toThrow(/color\.field=<name>/)
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

  test('the unit is a slot write that leaves the bezier overlay alone', () => {
    const { snap } = buildDisplaySnapshot('alignments', ['unit=chain'])
    expect(snap).toMatchObject({ unit: 'chain' })
    expect(snap).not.toHaveProperty('showBezierConnections')
  })

  test('the curved-connector overlay is a slot write', () => {
    const { snap } = buildDisplaySnapshot('alignments', [
      'showBezierConnections=true',
    ])
    expect(snap).toMatchObject({ showBezierConnections: true })
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
    expect(snap.sort).toBeUndefined()
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
  })

  test.each([
    'coverage',
    'coverageHeight:80',
    'softClipping',
    'legend',
    'maxHeight:4000',
    'sashimiScore:3',
    'sashimiHeight:120',
    'arcColor:insertSize',
    'readConnectionsHeight:100',
    'readConnectionsLineWidth:2',
    'unit:chain',
    'snpcov',
    'group:strand',
    'fill:false',
    'crosshatch',
    'scaletype:log',
    'minmax:0:10',
    'resolution:fine',
  ])('%s is no modifier: its slot is the spelling', opt => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(buildDisplaySnapshot('alignments', [opt]).snap).toEqual({})
    expect(warn).toHaveBeenCalledWith(
      `Warning: unknown track option "${opt.split(':')[0]}"`,
    )
    warn.mockRestore()
  })
})

describe('feature modifiers', () => {
  test('the facet is one slot on a feature and a variant track', () => {
    expect(buildDisplaySnapshot('feature', ['facet=strand']).snap).toEqual({
      facet: 'strand',
    })
    expect(buildDisplaySnapshot('variant', ['facet=INFO.SVTYPE']).snap).toEqual(
      { facet: 'INFO.SVTYPE' },
    )
  })

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
  test('display-chrome and sashimi settings are slot writes', () => {
    const { snap } = buildDisplaySnapshot('alignments', [
      'showLegend=true',
      'maxHeight=4000',
      'minSashimiScore=3',
      'sashimiArcsHeight=120',
      'arcColor=insertSize',
    ])
    expect(snap).toEqual({
      showLegend: true,
      maxHeight: 4000,
      minSashimiScore: 3,
      sashimiArcsHeight: 120,
      arcColor: 'insertSize',
    })
  })

  // The SV export: the split reads of the pairs the aligner did not call
  // concordant. Both halves land in one `filterBy`, so they compose with the
  // flag masks and tag filters below rather than sitting beside them.
  test('the read categories fold into filterBy', () => {
    expect(
      buildDisplaySnapshot('alignments', ['properPairs:exclude', 'split:only'])
        .snap.filter,
    ).toEqual({ properPairs: 'exclude', split: 'only' })
  })

  // `all` is the absent filter, so it stores nothing — which is what lets a
  // script pass a category through from a variable that may be empty.
  test('a category set to all stores nothing', () => {
    expect(
      buildDisplaySnapshot('alignments', ['singletons:all']).snap.filter,
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
      buildDisplaySnapshot('alignments', ['flags:2:1540']).snap.filter,
    ).toEqual({ flagInclude: 2, flagExclude: 1540 })
  })

  // An omitted half has to leave the display's own default alone rather than
  // become 0 -- `flags::256` reading as "include nothing" would silently drop
  // every read.
  test('an omitted half of flags is left unset', () => {
    expect(
      buildDisplaySnapshot('alignments', ['flags::256']).snap.filter,
    ).toEqual({ flagExclude: 256 })
    expect(buildDisplaySnapshot('alignments', ['flags:2']).snap.filter).toEqual(
      { flagInclude: 2 },
    )
  })

  // The names carry their own arithmetic, so a reader who wants "drop secondary
  // as well" writes that rather than working out that 1540 becomes 1796.
  test('flags takes samtools flag names as well as numbers', () => {
    expect(
      buildDisplaySnapshot('alignments', ['flags::SECONDARY,DUP']).snap.filter,
    ).toEqual({ flagExclude: 256 | 1024 })
    expect(
      buildDisplaySnapshot('alignments', ['flags:proper_pair']).snap.filter,
    ).toEqual({ flagInclude: 2 })
    // The display's own default mask, said both ways — and the pair below is
    // the reason the names are worth having: 1540 and 1796 differ by one bit
    // nobody reads off the number.
    expect(
      buildDisplaySnapshot('alignments', ['flags::UNMAP,QCFAIL,DUP']).snap
        .filter,
    ).toEqual(buildDisplaySnapshot('alignments', ['flags::1540']).snap.filter)
    expect(
      buildDisplaySnapshot('alignments', ['flags::UNMAP,SECONDARY,QCFAIL,DUP'])
        .snap.filter,
    ).toEqual(buildDisplaySnapshot('alignments', ['flags::1796']).snap.filter)
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
      ]).snap.filter,
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
    const { snap } = buildDisplaySnapshot('wiggle', [
      'sashimi:up',
      'flags:2:1540',
    ])
    expect(snap.showSashimiArcs).toBeUndefined()
    expect(snap.filter).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})

describe('score settings', () => {
  test('a whole-setting slot write joins the snapshot', () => {
    const { snap } = buildDisplaySnapshot('wiggle', [
      'mark=point',
      'resolution=100',
      'color:purple',
    ])
    expect(snap).toEqual({ mark: 'point', resolution: 100, color: 'purple' })
  })

  test('a member of the value scale waits for the display', () => {
    const { snap } = buildDisplaySnapshot('wiggle', [
      'scales.y.type=log',
      'scales.y.domainMax=1024',
    ])
    expect(snap).toEqual({})
  })
})

// Every display but hic answers `color:` through its own `color` slot, so the
// routing question is what lands there: a field object where the category names
// fields, the string otherwise. The multi-sample variant displays' `colorBy` is
// a sample-attribute string, so the {type, tag} object this used to write was
// dropped as an unknown MST key or rejected as a bad slot value.
describe('color routing', () => {
  test('color names a field on alignments and a solid color on wiggle', () => {
    expect(buildDisplaySnapshot('alignments', ['color:strand']).snap).toEqual({
      color: { field: 'strand' },
    })
    expect(buildDisplaySnapshot('wiggle', ['color:purple']).snap).toEqual({
      color: 'purple',
    })
  })

  test('baseColor draws over the reads, so it combines with a read color', () => {
    expect(
      buildDisplaySnapshot('alignments', [
        'color:mapq',
        'baseColor:methylation',
      ]).snap,
    ).toEqual({
      color: { field: 'mapq' },
      baseColor: { field: 'modifications' },
      modifications: { unmodified: 'all' },
    })
    expect(
      buildDisplaySnapshot('alignments', ['baseColor:baseQuality']).snap,
    ).toEqual({ baseColor: { field: 'baseQuality' } })
  })

  test('a per-base name on color: says which modifier draws it', () => {
    expect(() =>
      buildDisplaySnapshot('alignments', ['color:methylation']),
    ).toThrow(/baseColor:methylation/)
    expect(() =>
      buildDisplaySnapshot('alignments', ['baseColor:strand']),
    ).toThrow(/baseQuality/)
  })

  test('a whole-setting slot write joins the snapshot and a member write waits for the display', () => {
    expect(
      buildDisplaySnapshot('alignments', [
        'color:mapq',
        'color.domain=1,2',
        'modifications.threshold=50',
        'showOutline=false',
      ]).snap,
    ).toEqual({ color: { field: 'mapq' }, showOutline: false })
  })

  test('a JSON option merges into what earlier options wrote', () => {
    expect(
      buildDisplaySnapshot('alignments', [
        'color:mapq',
        '{"color":{"range":["rgb(1,2,3)"]},"height":300}',
      ]).snap,
    ).toEqual({
      color: { field: 'mapq', range: ['rgb(1,2,3)'] },
      height: 300,
    })
  })

  test('anything else on alignments is a CSS color for every read', () => {
    expect(buildDisplaySnapshot('alignments', ['color:purple']).snap).toEqual({
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
    }
  })

  test('color:strand names the field the canvas displays color by', () => {
    for (const category of ['feature', 'variant'] as const) {
      expect(buildDisplaySnapshot(category, ['color:strand']).snap).toEqual({
        color: { field: 'strand' },
      })
    }
    // wiggle has no strand notion — 'strand' stays a literal color there
    expect(buildDisplaySnapshot('wiggle', ['color:strand']).snap.color).toBe(
      'strand',
    )
  })

  test('color names the ramp on a hic track, and refuses what is not a scheme', () => {
    const { snap } = buildDisplaySnapshot('hic', ['color:viridis'])
    expect(snap.color).toEqual({ scheme: 'viridis' })
    expect(() => buildDisplaySnapshot('hic', ['color:red'])).toThrow(
      /Invalid color value "red"\. Expected a color scheme: viridis, /,
    )
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
    ['alignments', 'sort:', /Missing sort/],
    // a bare `arcs` used to mean OFF, the opposite of every other bare modifier
    ['alignments', 'arcs', /Missing arcs/],
    ['alignments', 'arcs:upp', /Invalid arcs value "upp"/],
    ['alignments', 'sashimi:downn', /Invalid sashimi/],
    ['alignments', 'featureHeight:bogus', /Invalid featureHeight/],
    ['feature', 'heightMode:bogus', /Invalid heightMode/],
    ['variant', 'display:', /Missing display/],
  ] as const)('%s track: %s rejects', (category, opt, message) => {
    expect(() => buildDisplaySnapshot(category, [opt])).toThrow(message)
  })

  test('force reads as a flag: bare or :true is on, :false is off', () => {
    expect(buildDisplaySnapshot('alignments', ['force']).snap.forceLoad).toBe(
      true,
    )
    expect(
      buildDisplaySnapshot('alignments', ['force:true']).snap.forceLoad,
    ).toBe(true)
    expect(
      buildDisplaySnapshot('alignments', ['force:false']).snap.forceLoad,
    ).toBe(false)
  })
})

describe('display type selection', () => {
  test('display:multivariant aliases to the multi-sample display', () => {
    expect(
      buildDisplaySnapshot('variant', ['display:multivariant']).displayType,
    ).toBe('LinearMultiSampleVariantDisplay')
  })

  test('display:multivariantmatrix is the multi-sample display in columns', () => {
    const { displayType, snap } = buildDisplaySnapshot('variant', [
      'display:multivariantmatrix',
    ])
    expect(displayType).toBe('LinearMultiSampleVariantDisplay')
    expect(snap.variantLayout).toBe('columns')
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
    '{"color":{"field":"strand"}}',
  ])
  expect(snap.color).toEqual({ field: 'strand' })
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

import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import {
  buildDisplaySnapshot,
  checkModifiers,
  filterEntriesOf,
  memberWrites,
} from './displaySettings.ts'

// the display each category's tests open their track as
const DISPLAY = {
  alignments: 'LinearAlignmentsDisplay',
  wiggle: 'LinearWiggleDisplay',
  feature: 'LinearBasicDisplay',
  variant: 'LinearVariantDisplay',
  hic: 'LinearHicDisplay',
  other: 'LinearMafDisplay',
} as const

// buildDisplaySnapshot turns a track's modifier list into a declarative display
// snapshot (passed to showTrack), instead of a sequence of setter actions.

describe('alignments modifiers', () => {
  test('a facet or color field is the slot write the display spells', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['facet=tags.HP']).snap,
    ).toEqual({
      facet: 'tags.HP',
    })
  })

  test('color:tag and color:attribute point at encoding.color.field', () => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['color:tag:XS']),
    ).toThrow(/encoding\.color\.field=tags\.<TAG>/)
    expect(() =>
      buildDisplaySnapshot('LinearBasicDisplay', [
        'color:attribute:gene_biotype',
      ]),
    ).toThrow(/encoding\.color\.field=<name>/)
  })

  test('height parses a number', () => {
    const { snap } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      'height:400',
    ])
    expect(snap.height).toBe(400)
  })

  test('arcs:cloud and arcs:down map to readConnections fields', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['arcs:cloud']).snap,
    ).toMatchObject({ readConnections: { show: true, mark: 'rule' } })
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['arcs:down']).snap,
    ).toMatchObject({
      readConnections: { show: true, mark: 'link', placement: 'down' },
    })
  })

  test('the unit is a slot write that leaves the curved connectors alone', () => {
    const { snap } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      'unit=chain',
    ])
    expect(snap).toMatchObject({ unit: 'chain' })
    expect(snap).not.toHaveProperty('pileup')
  })

  test('the curved-connector overlay is a band member, which waits for the display', () => {
    const { snap } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      'pileup.connectors.show=true',
    ])
    expect(snap).toEqual({})
  })

  test('sashimi:off hides arcs; sashimi:down sets the placement', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['sashimi:off']).snap,
    ).toMatchObject({ sashimi: { show: false } })
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['sashimi:down']).snap,
    ).toMatchObject({ sashimi: { show: true, placement: 'down' } })
  })

  test('sort is returned as an intent (resolved against the view)', () => {
    const { sort, snap } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      'sort:base',
    ])
    expect(sort).toEqual({ field: 'base' })
    expect(snap.sort).toBeUndefined()
  })

  test('sort:basePair is the base field, its name before v5', () => {
    const { sort } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      'sort:basePair',
    ])
    expect(sort).toEqual({ field: 'base' })
  })

  test('sort:tag:HP is the tags.HP field, and a tag sort names its tag', () => {
    const { sort } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      'sort:tag:HP',
    ])
    expect(sort).toEqual({ field: 'tags.HP' })
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['sort:tag']),
    ).toThrow(/tag:<TAG>/)
  })

  test('force sets the declarative forceLoad config slot', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['force:true']).snap,
    ).toEqual({
      forceLoad: true,
    })
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', []).snap.forceLoad,
    ).toBeUndefined()
  })

  test('featureHeight preset maps to per-read height (spacing is derived)', () => {
    const { snap } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      'featureHeight:super-compact',
    ])
    expect(snap).toMatchObject({ pileup: { mark: { height: 1 } } })
    expect(snap).not.toHaveProperty('featureSpacing')
  })

  test('featureHeight numeric sets pileup.mark.height on alignments', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['featureHeight:4']).snap
        .pileup?.mark?.height,
    ).toBe(4)
  })

  test('a band modifier keeps the members a JSON modifier wrote', () => {
    const { snap } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      '{"pileup":{"softClips":{"show":true}},"readConnections":{"height":100},"sashimi":{"labels":{"show":true}}}',
      'featureHeight:4',
      'arcs:down',
      'sashimi:auto',
    ])
    expect(snap).toMatchObject({
      pileup: { softClips: { show: true }, mark: { height: 4 } },
      readConnections: {
        height: 100,
        show: true,
        mark: 'link',
        placement: 'down',
      },
      sashimi: { labels: { show: true }, show: true, placement: 'auto' },
    })
  })

  test('featureHeight rejects a non-numeric, non-preset value', () => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['featureHeight:bogus']),
    ).toThrow(/Invalid featureHeight/)
  })

  test('a non-numeric height rejects instead of writing NaN', () => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['height:8o']),
    ).toThrow(/Invalid height/)
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
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', [opt]),
    ).toThrow(`unknown track option "${opt.split(':')[0]}:"`)
  })
})

describe('feature modifiers', () => {
  test('the facet is one slot on a feature and a variant track', () => {
    expect(
      buildDisplaySnapshot('LinearBasicDisplay', ['facet=strand']).snap,
    ).toEqual({
      facet: 'strand',
    })
    expect(
      buildDisplaySnapshot('LinearVariantDisplay', ['facet=INFO.SVTYPE']).snap,
    ).toEqual({ facet: 'INFO.SVTYPE' })
  })

  test('featureHeight preset maps to displayMode for canvas features', () => {
    const { snap } = buildDisplaySnapshot('LinearBasicDisplay', [
      'featureHeight:super-compact',
    ])
    expect(snap.displayMode).toBe('superCompact')
  })

  test('featureHeight numeric sets mark.height on canvas features', () => {
    const { snap } = buildDisplaySnapshot('LinearBasicDisplay', [
      'featureHeight:4',
    ])
    expect(snap.mark).toEqual({ height: 4 })
  })

  // A modifier aimed at the wrong track type used to be dropped in silence, so
  // `--gff genes.gff.gz sashimi:down` looked like it had worked.
  test('alignment-only modifiers warn on a feature track', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { snap } = buildDisplaySnapshot('LinearBasicDisplay', [
      'arcs:up',
      'sashimi:down',
    ])
    expect(snap.readConnections).toBeUndefined()
    expect(snap.sashimi).toBeUndefined()
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
      buildDisplaySnapshot('LinearBasicDisplay', ['heightMode:fit']).snap
        .heightMode,
    ).toBe('fit')
    expect(
      buildDisplaySnapshot('LinearBasicDisplay', ['heightMode:grow']).snap
        .heightMode,
    ).toBe('grow')
    expect(
      buildDisplaySnapshot('LinearBasicDisplay', ['heightMode:fixed']).snap
        .heightMode,
    ).toBe('fixed')
    expect(
      buildDisplaySnapshot('LinearBasicDisplay', []).snap.heightMode,
    ).toBeUndefined()
  })

  test('heightMode:mode:N sets both the strategy and the track height', () => {
    const { snap } = buildDisplaySnapshot('LinearBasicDisplay', [
      'heightMode:fit:200',
    ])
    expect(snap.height).toBe(200)
    expect(snap.heightMode).toBe('fit')
  })

  test('an unknown heightMode rejects', () => {
    expect(() =>
      buildDisplaySnapshot('LinearBasicDisplay', ['heightMode:bogus']),
    ).toThrow(/Invalid heightMode value "bogus". Expected fixed, grow, fit./)
  })

  // heightMode's optional second arg used to swallow a typo (`Number.isFinite`
  // guard), silently rendering at the default height
  test('a non-numeric heightMode height rejects', () => {
    expect(() =>
      buildDisplaySnapshot('LinearBasicDisplay', ['heightMode:fit:20o']),
    ).toThrow(/Invalid heightMode/)
  })

  // feature and variant displays extend the same LinearCanvasBaseDisplay, so
  // every modifier that reads one of its slots must accept both
  test('the canvas-base modifiers apply to feature and variant alike', () => {
    for (const category of ['feature', 'variant'] as const) {
      expect(
        buildDisplaySnapshot(DISPLAY[category], ['heightMode:grow']).snap
          .heightMode,
      ).toBe('grow')
      expect(
        buildDisplaySnapshot(DISPLAY[category], ['featureHeight:compact']).snap
          .displayMode,
      ).toBe('compact')
    }
  })

  test('alignments heightMode shares the full fixed/grow/fit vocabulary', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['heightMode:fit']).snap
        .heightMode,
    ).toBe('fit')
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['heightMode:grow']).snap
        .heightMode,
    ).toBe('grow')
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['heightMode:fixed']).snap
        .heightMode,
    ).toBe('fixed')
  })

  test('heightMode is ignored on a display type without the notion', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(
      buildDisplaySnapshot('LinearWiggleDisplay', ['heightMode:fixed']).snap
        .heightMode,
    ).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"heightMode" has no effect on a wiggle track'),
    )
    warn.mockRestore()
  })
})

describe('alignments settings a static export cannot reach any other way', () => {
  test('display-chrome settings are slot writes, band members wait for the display', () => {
    const { snap } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
      'showOutline=false',
      'legend.show=true',
      'pileup.maxLayoutHeight=4000',
      'sashimi.height=120',
      'readConnections.encoding.color.field=insertSize',
    ])
    expect(snap).toEqual({ showOutline: false })
  })

  const filterOf = (opts: string[]) =>
    buildDisplaySnapshot('LinearAlignmentsDisplay', opts).snap.filter!
  const testedOf = (opts: string[]) =>
    filterOf(opts).filter(p => Object.keys(p).length > 1)

  test('the read categories write their fields', () => {
    expect(filterOf(['svSignal:only', 'spliced:exclude'])).toEqual([
      { field: 'svSignal', equal: true },
      { field: 'spliced', equal: false },
    ])
  })

  test('mapq: writes a floor beside the other filters', () => {
    expect(filterOf(['mapq:20', 'split:only'])).toEqual([
      { field: 'mapq', gte: 20 },
      { field: 'split', equal: true },
    ])
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['mapq:high']),
    ).toThrow()
  })

  test('a later modifier on a field replaces the earlier one', () => {
    expect(filterOf(['mapq:20', 'split:only', 'mapq:30'])).toEqual([
      { field: 'split', equal: true },
      { field: 'mapq', gte: 30 },
    ])
  })

  // the bare field clears what the config set, which lets a script pass a
  // category through from a variable that may be empty
  test('a category set to all writes the bare field', () => {
    expect(filterOf(['alone:only', 'alone:all'])).toEqual([{ field: 'alone' }])
  })

  test('an unknown category value names the three that work', () => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['spliced:true']),
    ).toThrow(/all, only, exclude/)
  })

  // samtools' -f / -F, in that order, over all twelve flag fields
  test('flags writes every flag field', () => {
    const filter = filterOf(['flags:2:1540'])
    expect(filter).toHaveLength(12)
    expect(filter.filter(p => Object.keys(p).length > 1)).toEqual([
      { field: 'flags.PROPER_PAIR', equal: true },
      { field: 'flags.UNMAP', equal: false },
      { field: 'flags.QCFAIL', equal: false },
      { field: 'flags.DUP', equal: false },
    ])
    expect(filter).toContainEqual({ field: 'flags.SECONDARY' })
  })

  // samtools' meaning: `-F 256` alone lets unmapped, QC-failed and duplicate
  // reads through, so the default exclusions go too
  test('an omitted half of flags is mask 0', () => {
    expect(testedOf(['flags::256'])).toEqual([
      { field: 'flags.SECONDARY', equal: false },
    ])
    expect(filterOf(['flags::256'])).toContainEqual({ field: 'flags.DUP' })
    expect(testedOf(['flags:2'])).toEqual([
      { field: 'flags.PROPER_PAIR', equal: true },
    ])
  })

  // The names carry their own arithmetic, so a reader who wants "drop secondary
  // as well" writes that rather than working out that 1540 becomes 1796.
  test('flags takes samtools flag names as well as numbers', () => {
    expect(testedOf(['flags::SECONDARY,DUP'])).toEqual([
      { field: 'flags.SECONDARY', equal: false },
      { field: 'flags.DUP', equal: false },
    ])
    expect(testedOf(['flags:proper_pair'])).toEqual([
      { field: 'flags.PROPER_PAIR', equal: true },
    ])
    // The display's own default mask, said both ways — and the pair below is
    // the reason the names are worth having: 1540 and 1796 differ by one bit
    // nobody reads off the number.
    expect(filterOf(['flags::UNMAP,QCFAIL,DUP'])).toEqual(
      filterOf(['flags::1540']),
    )
    expect(filterOf(['flags::UNMAP,SECONDARY,QCFAIL,DUP'])).toEqual(
      filterOf(['flags::1796']),
    )
  })

  test('an unknown flag name lists the vocabulary', () => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['flags::SECONDRY']),
    ).toThrow(/PAIRED, PROPER_PAIR/)
  })

  test('tag filters on different tags accumulate beside the flag masks', () => {
    expect(
      testedOf(['flags:2', 'filterTag:HP:1', 'filterTag:RG:lane3']),
    ).toEqual([
      { field: 'flags.PROPER_PAIR', equal: true },
      { field: 'tags.HP', equal: '1' },
      { field: 'tags.RG', equal: 'lane3' },
    ])
  })

  test('a second value on one tag is an alternative', () => {
    expect(
      filterOf([
        'filterTag:RG:a',
        'filterTag:HP:1',
        'filterTag:RG:b',
        'filterTag:RG:a',
      ]),
    ).toEqual([
      { field: 'tags.HP', equal: '1' },
      { field: 'tags.RG', oneOf: ['a', 'b'] },
    ])
    expect(filterOf(['filterTag:RG:a', 'filterTag:RG'])).toEqual([
      { field: 'tags.RG', valid: true },
    ])
    expect(filterOf(['filterTag:RG', 'filterTag:RG:a'])).toEqual([
      { field: 'tags.RG', equal: 'a' },
    ])
  })

  test("a tag filter's value keeps its colons", () => {
    expect(filterOf(['filterTag:RG:HG002:fc1:1'])).toEqual([
      { field: 'tags.RG', equal: 'HG002:fc1:1' },
    ])
  })

  test.each([
    ['sort:tag:HP:x', /"sort:" takes 2 values, so ":x"/],
    ['sort:base:HP', /"sort:" takes one value, so ":HP"/],
    ['heightMode:fit:200:x', /"heightMode:" takes 2 values, so ":x"/],
    ['flags:2:1540:3', /"flags:" takes 2 values/],
    ['mapq:20:30', /"mapq:" takes one value, so ":30"/],
    ['color:red:x:y', /"color:" takes one value, so ":x:y"/],
  ])('a stray value in %s throws', (opt, message) => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', [opt]),
    ).toThrow(message)
  })

  test('a tag filter with no value passes any read carrying the tag', () => {
    expect(filterOf(['filterTag:HP'])).toEqual([
      { field: 'tags.HP', valid: true },
    ])
  })

  test('a settings bag writes the list the modifiers then edit by field', () => {
    expect(
      filterOf([
        '{"filter":[{"field":"mapq","gte":10},{"field":"tags.HP","equal":"1"}]}',
        'mapq:20',
      ]),
    ).toEqual([
      { field: 'tags.HP', equal: '1' },
      { field: 'mapq', gte: 20 },
    ])
  })

  test("a settings bag after a modifier keeps the modifier's fields", () => {
    expect(
      filterOf([
        'mapq:20',
        'filterTag:HP:1',
        '{"filter":[{"field":"split","equal":true},{"field":"tags.HP","equal":"2"}]}',
      ]),
    ).toEqual([
      { field: 'mapq', gte: 20 },
      { field: 'split', equal: true },
      { field: 'tags.HP', equal: '2' },
    ])
  })

  test('a filter= write edits by field as a modifier does', () => {
    expect(filterOf(['mapq:20', 'filter=split'])).toEqual([
      { field: 'mapq', gte: 20 },
      { field: 'split', equal: true },
    ])
  })

  test('range lifts to gte and lte as the config schema lifts it', () => {
    expect(
      filterEntriesOf([
        { field: 'score', range: [100, null] },
        { field: 'mapq', gte: 30, range: [20, 60] },
      ]),
    ).toEqual([
      { field: 'score', gte: 100 },
      { field: 'mapq', gte: 30, lte: 60 },
    ])
    expect(() => filterEntriesOf([{ field: 'score', range: [1] }])).toThrow(
      /range that is not \[min, max\]/,
    )
  })

  test('a string entry is the shorthand the config schema reads', () => {
    const list = ['split', 'jexl:feature.score > 1', { field: 'mapq', gte: 5 }]
    expect(filterEntriesOf(list)).toEqual(predicatesOf(list))
  })

  test.each([
    [{ field: 'flags.DUP', equals: true }, /has no test "equals"/],
    [null, /is not an object/],
    [{ equal: true }, /names no field/],
    [{ field: '' }, /names no field/],
    [{ field: 'mapq', gte: '20' }, /has a gte of the wrong type/],
    [{ field: 'tags.RG', oneOf: 'a' }, /has a oneOf of the wrong type/],
    [{ field: 'tags.RG', oneOf: [{}] }, /has a oneOf of the wrong type/],
    ['', /is empty/],
    [7, /is not an object/],
  ])('a bag entry %j throws', (entry, message) => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', [
        JSON.stringify({ filter: [entry] }),
      ]),
    ).toThrow(message)
    expect(() => {
      checkModifiers([JSON.stringify({ filter: [entry] })])
    }).toThrow(message)
  })

  test("v4's object form is refused", () => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', [
        '{"filter":{"junctions":{"nonCanonical":"exclude"}}}',
        'split:only',
      ]),
    ).toThrow(/a list of \{ field, ... \} entries/)
  })

  test('the new alignments modifiers warn on a wiggle track', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { snap } = buildDisplaySnapshot('LinearWiggleDisplay', [
      'sashimi:up',
      'flags:2:1540',
    ])
    expect(snap.sashimi).toBeUndefined()
    expect(snap.filter).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})

describe('score settings', () => {
  test('a whole-setting slot write joins the snapshot', () => {
    const { snap } = buildDisplaySnapshot('LinearWiggleDisplay', [
      'mark=point',
      'origin=5',
      'color:purple',
    ])
    expect(snap).toEqual({
      mark: 'point',
      origin: 5,
      encoding: { color: { value: 'purple' } },
    })
  })

  test('a member of the value scale waits for the display', () => {
    const { snap } = buildDisplaySnapshot('LinearWiggleDisplay', [
      'scales.y.type=log',
      'scales.y.domainMax=1024',
    ])
    expect(snap).toEqual({})
  })
})

// Every display but hic answers `color:` through its own `encoding.color`
// channel, so the routing question is what lands there: the field where the
// category names fields, the constant `{ value }` otherwise. The multi-sample
// variant displays' `colorBy` is a sample-attribute string, so the {type, tag}
// object this used to write was dropped as an unknown MST key or rejected as a
// bad slot value.
describe('color routing', () => {
  test('color names a field on alignments and a solid color on wiggle', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['color:strand']).snap,
    ).toEqual({
      encoding: { color: 'strand' },
    })
    expect(
      buildDisplaySnapshot('LinearWiggleDisplay', ['color:purple']).snap,
    ).toEqual({
      encoding: { color: { value: 'purple' } },
    })
  })

  test('color names a facet dimension as a read field', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['color:mateAssembly'])
        .snap,
    ).toEqual({ encoding: { color: 'mateAssembly' } })
  })

  test('baseColor draws over the reads, so it combines with a read color', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', [
        'color:mapq',
        'baseColor:methylation',
      ]).snap,
    ).toEqual({
      encoding: { color: 'mapq' },
      pileup: {
        bases: {
          show: true,
          encoding: { color: 'modifications' },
          unmodified: { show: true },
        },
      },
    })
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', [
        'featureHeight:compact',
        'baseColor:baseQuality',
      ]).snap,
    ).toEqual({
      pileup: {
        mark: { height: 3 },
        bases: { show: true, encoding: { color: 'baseQuality' } },
      },
    })
  })

  test('a per-base name on color: says which modifier draws it', () => {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['color:methylation']),
    ).toThrow(/baseColor:methylation/)
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['baseColor:strand']),
    ).toThrow(/baseQuality/)
  })

  test('a read category on color: names the facet that groups by it', () => {
    for (const field of ['pairing', 'split', 'spliced', 'svSignal']) {
      expect(() =>
        buildDisplaySnapshot('LinearAlignmentsDisplay', [`color:${field}`]),
      ).toThrow(`facet=${field}`)
    }
  })

  test('a whole-setting slot write joins the snapshot and a member write waits for the display', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', [
        'color:mapq',
        'encoding.color.scale.domain=1,2',
        'pileup.bases.unmodified.show=true',
        'showOutline=false',
      ]).snap,
    ).toEqual({ encoding: { color: 'mapq' }, showOutline: false })
  })

  test('a JSON option merges into what earlier options wrote', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', [
        'color:purple',
        '{"encoding":{"color":{"scale":{"range":["rgb(1,2,3)"]}}},"height":300}',
      ]).snap,
    ).toEqual({
      encoding: {
        color: { value: 'purple', scale: { range: ['rgb(1,2,3)'] } },
      },
      height: 300,
    })
  })

  test('anything else on alignments is a CSS color for every read', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['color:purple']).snap,
    ).toEqual({
      encoding: { color: { value: 'purple' } },
    })
  })

  // The canvas displays take a CSS color or a jexl as the same `{ value }`
  // the wiggle display uses — never a colorBy object, which is what used to
  // be written for them and dropped as an unknown MST key.
  test('color sets a solid color on the canvas-based displays', () => {
    for (const category of ['feature', 'variant'] as const) {
      const { snap } = buildDisplaySnapshot(DISPLAY[category], ['color:red'])
      expect(snap).toEqual({ encoding: { color: { value: 'red' } } })
    }
  })

  test('color:strand names the field the canvas displays color by', () => {
    for (const category of ['feature', 'variant'] as const) {
      expect(
        buildDisplaySnapshot(DISPLAY[category], ['color:strand']).snap,
      ).toEqual({
        encoding: { color: 'strand' },
      })
    }
    // wiggle has no strand notion — 'strand' stays a literal color there
    expect(
      buildDisplaySnapshot('LinearWiggleDisplay', ['color:strand']).snap
        .encoding?.color,
    ).toEqual({ value: 'strand' })
  })

  test("a color field picked over another's channel keeps none of its scale", () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', [
        '{"encoding":{"color":{"field":"mapq","scale":{"domain":[0,60]}}}}',
        'color:strand',
      ]).snap.encoding?.color,
    ).toBe('strand')
  })

  test('the field already named keeps its scale, and a new field keeps the constant', () => {
    const scaled =
      '{"encoding":{"color":{"field":"mapq","scale":{"domain":[0,60]}}}}'
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', [scaled, 'color:mapq'])
        .snap.encoding?.color,
    ).toEqual({ field: 'mapq', scale: { domain: [0, 60] } })
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', [
        'color:purple',
        'color:strand',
      ]).snap.encoding?.color,
    ).toEqual({ value: 'purple', field: 'strand' })
  })

  test('color names the ramp on a hic track, and refuses what is not a scheme', () => {
    const opts = ['color:viridis', 'encoding.color.scale.reverse=true']
    expect(buildDisplaySnapshot('LinearHicDisplay', opts).snap).toEqual({})
    expect(memberWrites('LinearHicDisplay', opts)).toEqual([
      'encoding.color.scale.scheme=viridis',
      'encoding.color.scale.reverse=true',
    ])
    expect(memberWrites('LinearAlignmentsDisplay', ['color:strand'])).toEqual(
      [],
    )
    expect(() =>
      buildDisplaySnapshot('LinearHicDisplay', ['color:red']),
    ).toThrow(/Invalid color value "red"\. Expected a color scheme: viridis, /)
  })
})

// One rule for every modifier value, whatever the track type: a value the
// modifier can't use is an error. jb2export writes a figure and exits, so a
// warning scrolls past and leaves a wrong image behind.
describe('modifier values are validated the same way everywhere', () => {
  test.each([
    ['alignments', 'height:', /Missing height/],
    ['alignments', 'height:8o', /Invalid height/],
    ['alignments', 'height:Infinity', /Invalid height/],
    ['alignments', 'mapq: ', /Invalid mapq/],
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
    expect(() => buildDisplaySnapshot(DISPLAY[category], [opt])).toThrow(
      message,
    )
  })

  test('force reads as a flag: bare or :true is on, :false is off', () => {
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['force']).snap.forceLoad,
    ).toBe(true)
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['force:true']).snap
        .forceLoad,
    ).toBe(true)
    expect(
      buildDisplaySnapshot('LinearAlignmentsDisplay', ['force:false']).snap
        .forceLoad,
    ).toBe(false)
  })
})

describe('display type selection', () => {
  test('display:multivariant aliases to the multi-sample display', () => {
    expect(
      buildDisplaySnapshot('LinearVariantDisplay', ['display:multivariant'])
        .displayType,
    ).toBe('LinearMultiSampleVariantDisplay')
  })

  test('display:multivariantmatrix is the multi-sample display in columns', () => {
    const { displayType, snap } = buildDisplaySnapshot('LinearVariantDisplay', [
      'display:multivariantmatrix',
    ])
    expect(displayType).toBe('LinearMultiSampleVariantDisplay')
    expect(snap.variantLayout).toBe('columns')
  })

  test('an unknown display value passes through verbatim', () => {
    expect(
      buildDisplaySnapshot('LinearVariantDisplay', ['display:SomeOtherDisplay'])
        .displayType,
    ).toBe('SomeOtherDisplay')
  })

  test('no display modifier leaves displayType undefined (track default)', () => {
    expect(
      buildDisplaySnapshot('LinearVariantDisplay', []).displayType,
    ).toBeUndefined()
  })
})

test('a {...} token is merged as raw JSON', () => {
  const { snap } = buildDisplaySnapshot('LinearAlignmentsDisplay', [
    '{"encoding":{"color":"strand"}}',
  ])
  expect(snap.encoding?.color).toBe('strand')
})

test('an unknown modifier throws, naming the known ones', () => {
  expect(() =>
    buildDisplaySnapshot('LinearAlignmentsDisplay', ['colour:red']),
  ).toThrow(/unknown track option "colour:"; the options are height, .*color/)
})

// The modifier table is keyed by raw CLI input, so a name inherited from
// Object.prototype read as a known modifier and died on its undefined `on` list
test('an Object.prototype key is an unknown modifier, not a crash', () => {
  for (const name of ['constructor', 'toString', 'hasOwnProperty']) {
    expect(() =>
      buildDisplaySnapshot('LinearAlignmentsDisplay', [`${name}:x`]),
    ).toThrow(`unknown track option "${name}:"`)
  }
  // the alias tables are keyed the same way
  expect(
    buildDisplaySnapshot('LinearVariantDisplay', ['display:constructor'])
      .displayType,
  ).toBe('constructor')
  expect(
    buildDisplaySnapshot('LinearAlignmentsDisplay', ['sort:constructor']).sort,
  ).toEqual({ field: 'constructor' })
})

// `index:` is consumed at config-build time (readData) but still rides in a
// track's modifier list, so it must be a recognized no-op here rather than
// warning like a typo.
test('index: is a recognized no-op, not an unknown-option warning', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const { snap } = buildDisplaySnapshot('LinearBasicDisplay', [
    'index:https://x/y.bed.gz.csi',
    'height:100',
  ])
  expect(snap).toEqual({ height: 100 })
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

test('checkModifiers refuses only what no kind of track takes', () => {
  expect(() => {
    checkModifiers([
      'color:strand',
      'featureHeight:compact',
      'sort:base',
      'filterTag:RG',
      'encoding.color.field=type',
      'arcs:up',
      'name:x',
    ])
  }).not.toThrow()
  for (const [modifier, refusal] of [
    ['height:abc', /height value "abc"/],
    ['mapq:x', /mapq value "x"/],
    ['bogus:1', /unknown track option/],
  ] as const) {
    expect(() => {
      checkModifiers([modifier])
    }).toThrow(refusal)
  }
})

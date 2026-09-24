import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { TrackColorsMixin } from './TrackColorsMixin.ts'

import type { AttributeRange } from './colorRamps.ts'

// The floating legend is one box for the whole view, so the domain it labels a
// column's ramp with has to be one answer for every loaded display.
// A per-display answer is what makes that one legend lie.
function viewWith(loaded: Record<string, AttributeRange>[]) {
  return TrackColorsMixin()
    .views(() => ({
      loadedAttributeRanges() {
        return loaded
      },
    }))
    .create({})
}

describe('attributeRanges', () => {
  it('is empty before any display has loaded', () => {
    // an attribute mode resolves to a flat 0..0 domain on this, which is the
    // documented no-data answer rather than a NaN ramp
    expect(viewWith([]).attributeRanges).toEqual({})
  })

  it('passes a single display through unchanged', () => {
    expect(viewWith([{ dn: { min: 0, max: 2 } }]).attributeRanges).toEqual({
      dn: { min: 0, max: 2 },
    })
  })

  it('unions the span of a column two displays both carry', () => {
    // the case the getter exists for: labelling the shared ramp from either
    // display alone understates it, and the ribbons of the other one then paint
    // past the end of the domain the legend claims
    expect(
      viewWith([{ dn: { min: 0.5, max: 2 } }, { dn: { min: 0.1, max: 9 } }])
        .attributeRanges,
    ).toEqual({ dn: { min: 0.1, max: 9 } })
  })

  it('keeps a column only one display carries', () => {
    expect(
      viewWith([{ dn: { min: 1, max: 2 } }, { goc: { min: 30, max: 100 } }])
        .attributeRanges,
    ).toEqual({ dn: { min: 1, max: 2 }, goc: { min: 30, max: 100 } })
  })

  it('ignores a display that loaded no attributes at all', () => {
    // a display still fetching, or a track declaring no numeric columns
    expect(
      viewWith([{}, { dn: { min: 1, max: 2 } }, {}]).attributeRanges,
    ).toEqual({ dn: { min: 1, max: 2 } })
  })
})

// A fetch reports the span of the window it holds, so painting off that alone
// re-maps every ribbon onto the ramp each time a pan rolls the window over.
describe('the domain accumulated across fetches', () => {
  it('holds the span a pan has left behind', () => {
    const loaded = [{ dn: { min: 0, max: 2 } }]
    const view = viewWith(loaded)
    view.observeAttributeRanges(loaded[0]!)
    loaded[0] = { dn: { min: 8, max: 9 } }
    view.observeAttributeRanges(loaded[0])
    expect(view.attributeRanges).toEqual({ dn: { min: 0, max: 9 } })
  })

  // The identity, not just the value: this is read through a computed on every
  // recolor, and a fresh object per fetch that said nothing new would re-run
  // every color pass and re-upload every instance buffer behind it.
  it('is the SAME OBJECT after a fetch that says nothing new', () => {
    const view = viewWith([])
    view.observeAttributeRanges({ dn: { min: 0, max: 2 } })
    const first = view.seenAttributeRanges
    view.observeAttributeRanges({ dn: { min: 0.5, max: 1 } })
    expect(view.seenAttributeRanges).toBe(first)
  })

  it('and reading it past a loaded span already inside it allocates nothing', () => {
    const view = viewWith([{ dn: { min: 0.5, max: 1 } }])
    view.observeAttributeRanges({ dn: { min: 0, max: 2 } })
    expect(view.attributeRanges).toBe(view.seenAttributeRanges)
  })

  // The way back. One window holding an outlier would otherwise compress the
  // ramp for the rest of the session, and the union is over the LOADED spans —
  // so the rescale lands without waiting for a refetch.
  it('is dropped by picking a mode, rescaling to what is loaded', () => {
    const view = viewWith([{ dn: { min: 0, max: 1 } }])
    view.observeAttributeRanges({ dn: { min: 0, max: 900 } })
    expect(view.attributeRanges).toEqual({ dn: { min: 0, max: 900 } })
    view.setColorBy('dn')
    expect(view.attributeRanges).toEqual({ dn: { min: 0, max: 1 } })
  })
})

// A text column's domain is its label list. It widens the way a span does, by
// first-seen order, so a label keeps its palette slot when a later window adds
// labels around it.
describe('a categorical column', () => {
  it('unions label lists in first-seen order and keeps the first file color', () => {
    const view = viewWith([])
    view.observeAttributeRanges({
      group: { labels: ['B1', 'A1a'], colors: { B1: '#111111' } },
    })
    view.observeAttributeRanges({
      group: {
        labels: ['A1a', 'C1'],
        colors: { B1: '#222222', C1: '#333333' },
      },
    })
    expect(view.attributeRanges).toEqual({
      group: {
        labels: ['B1', 'A1a', 'C1'],
        colors: { B1: '#111111', C1: '#333333' },
      },
    })
  })

  it('is the SAME OBJECT after a fetch of labels already seen', () => {
    const view = viewWith([])
    view.observeAttributeRanges({ group: { labels: ['B1'], colors: {} } })
    const first = view.seenAttributeRanges
    view.observeAttributeRanges({ group: { labels: ['B1'], colors: {} } })
    expect(view.seenAttributeRanges).toBe(first)
  })

  // The accumulation stays first-seen and the domain applies at the read, so
  // clearing it gives back the order the fetches found. A label's color is its
  // position in the list, so this moves the drawing with the key.
  it('reads its labels in the declared order, and gives them back when it is cleared', () => {
    const view = viewWith([])
    view.observeAttributeRanges({
      group: { labels: ['B1', 'A1a', 'C1'], colors: {} },
    })
    view.setColorDomain(['C1'])
    expect(view.attributeRanges).toEqual({
      group: { labels: ['C1', 'A1a', 'B1'], colors: {}, domain: ['C1'] },
    })
    view.setColorDomain([])
    expect(view.attributeRanges).toBe(view.seenAttributeRanges)
  })

  it('lists the key in that order too, and only for a column mode', () => {
    const view = viewWith([])
    view.setColorBy('group')
    view.observeAttributeRanges({
      group: { labels: ['B1', 'A1a', 'C1'], colors: {} },
    })
    view.setColorDomain(['C1'])
    const labels = () =>
      view.legendSpec.sections[0]!.items.map(item => item.label)
    expect(labels()).toEqual(['C1', 'A1a', 'B1'])

    // a later fetch meeting an unlabelled row adds the grey it paints
    view.observeAttributeRanges({
      group: { labels: ['B1'], colors: {}, missing: true },
    })
    expect(labels()).toEqual(['C1', 'A1a', 'B1', NO_VALUE_LABEL])

    view.setColorBy('track')
    expect(view.colorScales[0]!.kind === 'categorical').toBe(true)
    expect(
      view.colorScales[0]!.kind === 'categorical'
        ? view.colorScales[0]!.domain
        : undefined,
    ).toBeUndefined()
  })

  it('takes over a numeric span under the same name', () => {
    const view = viewWith([])
    view.observeAttributeRanges({ group: { min: 3, max: 7 } })
    view.observeAttributeRanges({ group: { labels: ['7', 'x'], colors: {} } })
    expect(view.attributeRanges).toEqual({
      group: { labels: ['7', 'x'], colors: {} },
    })
  })
})

// A whole-genome dotplot is mostly dots with no slope, so its strand colour is
// the only strand cue on screen and gets the key a ribbon's twist makes
// unnecessary.
test('strand keys its two colours on points, and nothing on ribbons', () => {
  const on = (surface: 'points' | 'ribbons') =>
    TrackColorsMixin()
      .views(() => ({
        colorSurface() {
          return surface
        },
      }))
      .create({ colorBy: { field: 'strand' } })
  expect(
    on('points').legendSpec.sections[0]!.items.map(item => item.label),
  ).toEqual(['forward', 'reverse'])
  expect(on('points').showLegend).toBe(true)
  expect(on('ribbons').showLegend).toBe(false)
  expect(on('ribbons').legendSpec.sections).toEqual([])
})

// A launched stack puts one track on every level, so the view lists it once per
// level. The legend names a track once, in the color it paints.
test('the track legend lists a track on several levels once', () => {
  const view = TrackColorsMixin()
    .views(() => ({
      colorableTrackConfigs() {
        return [
          { trackId: 'ortho', name: '<b>orthogroups</b>' },
          { trackId: 'ortho', name: '<b>orthogroups</b>' },
          { trackId: 'other', name: 'other' },
        ]
      },
    }))
    .create({ colorBy: { field: 'track' } })
  expect(view.colorLegendChips).toEqual([
    { label: 'orthogroups', color: view.trackColorFor('ortho') },
    { label: 'other', color: view.trackColorFor('other') },
  ])
})

// The view's `colorBy` is one SyntenyColor object: a field the view reads as a
// mode of its own, a measurement preset, a declared column, or a colour.
describe('the colorBy object', () => {
  const view = (colorBy: unknown) =>
    TrackColorsMixin().create({ colorBy } as never)

  it('reads the structural fields as their modes', () => {
    for (const field of ['strand', 'query', 'target', 'reference', 'track']) {
      expect(view({ field }).colorByField).toBe(field)
    }
  })

  it('reads a preset by the attribute it paints, and any other field as a column', () => {
    expect(view({ field: 'mappingQual' }).colorByField).toBe('mappingQual')
    expect(view({ field: 'dnds' }).colorByField).toBe('dnds')
    expect(view({ field: 'gene_group' }).colorByField).toBe('gene_group')
  })

  it('lifts a colour string into value, which the default mode paints', () => {
    const v = view('grey')
    expect(v.colorByField).toBe('')
    expect(v.colorByValue).toBe('grey')
    expect(getSnapshot(v).colorBy).toEqual({ value: 'grey' })
  })

  it('refuses a mode string where a colour goes, naming the value', () => {
    expect(() => view('strand')).toThrow('strand')
  })

  it('refuses a key the object does not declare', () => {
    expect(() => view({ fields: 'strand' })).toThrow(
      'SyntenyColor takes value, field, scale and domain, not fields',
    )
  })

  it('clears on null and on omission', () => {
    expect(view(null).colorByField).toBe('')
    expect(view(undefined).colorByField).toBe('')
    expect(getSnapshot(view(null)).colorBy).toBeUndefined()
  })

  it('writes the whole object from a picked mode, keeping the field under none', () => {
    const v = view({ field: 'gene_group', domain: ['B1'] })
    v.setColorBy('')
    expect(getSnapshot(v).colorBy).toEqual({
      field: 'gene_group',
      domain: ['B1'],
      scale: 'none',
    })
    expect(v.colorByField).toBe('')
    v.setColorBy('gene_group')
    expect(getSnapshot(v).colorBy).toEqual({
      field: 'gene_group',
      domain: ['B1'],
    })
    v.setColorBy('query')
    expect(getSnapshot(v).colorBy).toEqual({ field: 'query' })
    v.setColorDomain(['chr2'])
    expect(getSnapshot(v).colorBy).toEqual({
      field: 'query',
      domain: ['chr2'],
    })
    expect(v.colorDomain).toEqual(['chr2'])
  })
})

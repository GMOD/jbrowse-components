import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'
import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { TrackColorsMixin } from './TrackColorsMixin.ts'
import { colorByMenuItems } from './colorByMenuItems.tsx'
import { colorByMenuTargetFor } from './colorByMenuTarget.ts'
import { categoricalColor } from './colorFunctions.ts'
import { resolveCategoricalMode } from './colorRamps.ts'

import type { AttributeRange } from './colorRamps.ts'

const snapColor = (view: { encoding: object }) =>
  (getSnapshot(view.encoding) as { color?: unknown } | undefined)?.color

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
    view.setColorField('dn')
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
  // clearing it gives back the order the fetches found. The first-seen order
  // rides beside the sorted one, since it is what deals the colors.
  it('reads its labels in the declared order, and gives them back when it is cleared', () => {
    const view = viewWith([])
    view.observeAttributeRanges({
      group: { labels: ['B1', 'A1a', 'C1'], colors: {} },
    })
    view.setColorDomain(['C1'])
    expect(view.attributeRanges).toEqual({
      group: {
        labels: ['C1', 'A1a', 'B1'],
        seen: ['B1', 'A1a', 'C1'],
        colors: {},
        domain: ['C1'],
      },
    })
    view.setColorDomain([])
    expect(view.attributeRanges).toBe(view.seenAttributeRanges)
  })

  // A pick rewrites the channel as written, so a member it does not change,
  // such as `legend.descending`, survives it.
  it('keeps what a field pick or a reorder does not change', () => {
    const view = TrackColorsMixin().create({
      encoding: {
        color: {
          field: 'identity',
          scale: { type: 'threshold', domain: ['0.9'] },
          legend: { descending: true },
        },
      },
    })
    view.setColorField('identity')
    view.setColorDomain(['0.95'])
    expect(snapColor(view)).toEqual({
      field: 'identity',
      scale: { type: 'threshold', domain: ['0.95'] },
      legend: { descending: true },
    })
  })

  it('lists the key in that order too, and only for a column mode', () => {
    const view = viewWith([])
    view.setColorField('group')
    view.observeAttributeRanges({
      group: { labels: ['B1', 'A1a', 'C1'], colors: {} },
    })
    view.setColorDomain(['C1'])
    const labels = () =>
      legendSpecOf(view.colorScales).sections[0]!.items.map(item => item.label)
    expect(labels()).toEqual(['C1', 'A1a', 'B1'])

    // a later fetch meeting an unlabelled row adds the grey it paints
    view.observeAttributeRanges({
      group: { labels: ['B1'], colors: {}, missing: true },
    })
    expect(labels()).toEqual(['C1', 'A1a', 'B1', NO_VALUE_LABEL])

    view.setColorField('track')
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

// A text column's range colors its labels, its names rename them in the key
// and its title heads the key. None of them reorders what the fetches found.
describe("a text column's range, names and title", () => {
  const view = (color: Record<string, unknown>) =>
    TrackColorsMixin().create({
      encoding: { color: { field: 'group', ...color } },
    })
  const seen = { group: { labels: ['B1', 'A1a'], colors: {} } }
  const colorOf = (v: ReturnType<typeof view>, label: string) =>
    categoricalColor(resolveCategoricalMode('group', v.attributeRanges)!, label)
  const keyOf = (v: ReturnType<typeof view>) => {
    const [section] = legendSpecOf(v.colorScales).sections
    return { title: section!.title, labels: section!.items.map(i => i.label) }
  }

  it('paints the domain from range and names it by names under title', () => {
    const v = view({
      scale: { domain: ['A1a'], range: ['#ff0000'], names: ['Subgenome A'] },
      legend: { title: 'Gene group' },
    })
    v.observeAttributeRanges(seen)
    expect(colorOf(v, 'A1a')).toBe('#ff0000')
    expect(colorOf(v, 'B1')).not.toBe('#ff0000')
    expect(keyOf(v)).toEqual({
      title: 'Gene group',
      labels: ['Subgenome A', 'B1'],
    })
  })

  it('samples its scheme once per domain value where it lists no range', () => {
    const v = view({ scale: { domain: ['A1a', 'B1'], scheme: 'viridis' } })
    v.observeAttributeRanges(seen)
    const [first, last] = stopsFromRampLut(
      rampLutOf({ scheme: 'viridis' }),
      2,
    ).map(stop => stop.color)
    expect(colorOf(v, 'A1a')).toBe(first)
    expect(colorOf(v, 'B1')).toBe(last)
  })

  it('takes range alone without reordering the labels', () => {
    const v = view({ scale: { range: ['#ff0000', '#00ff00'] } })
    v.observeAttributeRanges(seen)
    expect(v.attributeRanges.group).toMatchObject({ labels: ['B1', 'A1a'] })
    for (const label of ['B1', 'A1a']) {
      expect(['#ff0000', '#00ff00']).toContain(colorOf(v, label))
    }
  })

  it('draws no heading under an empty title, and the field name when unset', () => {
    const titleOf = (title?: string) => {
      const v = view(title === undefined ? {} : { legend: { title } })
      v.observeAttributeRanges(seen)
      return v.colorScales[0]!.title
    }
    expect(titleOf()).toBe('group')
    expect(titleOf('')).toBe('')
  })

  it('recolors nothing when only the title or names change', () => {
    const v = view({ scale: { domain: ['A1a'], range: ['#ff0000'] } })
    v.observeAttributeRanges(seen)
    const reads: unknown[] = []
    const stop = autorun(() => {
      reads.push(v.attributeRanges)
    })
    v.encoding.color.legend.setSlot('title', 'Gene group')
    v.encoding.color.scale.setSlot('names', ['Subgenome A'])
    stop()
    expect(reads).toHaveLength(1)
  })

  it('keeps all three through a domain pin and a re-pick of the field', () => {
    const scale = {
      domain: ['A1a'],
      range: ['#ff0000'],
      names: ['Subgenome A'],
    }
    const legend = { title: 'Gene group' }
    const v = view({ scale, legend })
    const pinned = {
      field: 'group',
      scale: { ...scale, domain: ['A1a', 'B1'] },
      legend,
    }
    v.setColorDomain(['A1a', 'B1'])
    expect(snapColor(v)).toEqual(pinned)
    v.setColorField('group')
    expect(snapColor(v)).toEqual(pinned)
  })
})

// A whole-genome dotplot is mostly dots with no slope, so its strand color is
// the only strand cue on screen and gets the key a ribbon's twist makes
// unnecessary.
test('strand keys its two colors on points, and nothing on ribbons', () => {
  const on = (surface: 'points' | 'ribbons') =>
    TrackColorsMixin()
      .views(() => ({
        colorSurface() {
          return surface
        },
      }))
      .create({ encoding: { color: 'strand' } })
  expect(
    legendSpecOf(on('points').colorScales).sections[0]!.items.map(
      item => item.label,
    ),
  ).toEqual(['forward', 'reverse'])
  expect(on('points').hasLegendKey).toBe(true)
  expect(on('ribbons').hasLegendKey).toBe(false)
  expect(legendSpecOf(on('ribbons').colorScales).sections).toEqual([])
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
    .create({ encoding: { color: 'track' } })
  expect(view.colorLegendChips).toEqual([
    { label: 'orthogroups', color: view.trackColorFor('ortho') },
    { label: 'other', color: view.trackColorFor('other') },
  ])
})

// The view's `encoding.color` is one SyntenyColor channel: a field the view
// reads as a mode of its own, a measurement preset, a declared column, or a
// color.
describe('the color channel', () => {
  const view = (color: unknown) =>
    TrackColorsMixin().create({ encoding: { color } })

  it('reads the structural fields as their modes', () => {
    for (const field of ['strand', 'query', 'target', 'reference', 'track']) {
      expect(view({ field }).colorField).toBe(field)
    }
  })

  it('reads a preset by the attribute it paints, and any other field as a column', () => {
    expect(view({ field: 'mapq' }).colorField).toBe('mapq')
    expect(view({ field: 'dnds' }).colorField).toBe('dnds')
    expect(view({ field: 'gene_group' }).colorField).toBe('gene_group')
  })

  it('reads a string as the field, and paints value under the default mode', () => {
    expect(view('strand').colorField).toBe('strand')
    expect(snapColor(view('strand'))).toEqual({ field: 'strand' })
    const v = view({ value: 'grey' })
    expect(v.colorField).toBeUndefined()
    expect(v.colorValue).toBe('grey')
  })

  it('refuses a color string where the field goes, naming the value', () => {
    expect(() => view('grey')).toThrow('"grey" is a color')
  })

  it('names a key the object does not declare, and loads without it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(snapColor(view({ fields: 'strand' }))).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      'SyntenyColor does not declare fields: loading without it',
    )
    warn.mockRestore()
  })

  it('keys a declared ramp, keeps it through a domain edit, and drops it on a new field', () => {
    const v = view({
      field: 'identity',
      scale: { scheme: 'magma', domainMin: 0.9 },
    })
    expect(v.colorPaint).toMatchObject({ scheme: 'magma', domainMin: 0.9 })
    const [ramp] = v.colorScales
    expect(ramp?.kind === 'ramp' && ramp.domain).toEqual([0.9, 1])
    v.setColorDomain(['a'])
    expect(snapColor(v)).toMatchObject({
      scale: { scheme: 'magma', domainMin: 0.9 },
    })
    v.setColorField('mapq')
    expect(snapColor(v)).toEqual({ field: 'mapq' })
  })

  it('reads the slot default field "" as the plain fill, with Default checked', () => {
    const v = view({ field: '' })
    expect(v.colorField).toBeUndefined()
    expect(v.hasLegendKey).toBe(false)
    expect(v.colorScales).toEqual([])
    const [first] = colorByMenuItems(colorByMenuTargetFor(v))
    expect(first).toMatchObject({ label: 'Default', checked: true })
  })

  it('writes no predicate for Hide unlabelled rows with no field', () => {
    const v = view({})
    v.setHideUnlabelled(true)
    expect(v.predicates).toEqual([])
    expect(v.hideUnlabelled).toBe(false)
  })

  it('clears on null and on omission', () => {
    expect(view(null).colorField).toBeUndefined()
    expect(view(undefined).colorField).toBeUndefined()
    expect(snapColor(view(null))).toBeUndefined()
  })

  it('writes the whole object from a picked mode, parking the field it leaves', () => {
    const v = view({ field: 'gene_group', scale: { domain: ['B1'] } })
    v.setColorField(undefined)
    expect(snapColor(v)).toBeUndefined()
    expect(v.colorField).toBeUndefined()
    v.setColorField('gene_group')
    expect(snapColor(v)).toEqual({
      field: 'gene_group',
      scale: { domain: ['B1'] },
    })
    v.setColorField('query')
    expect(snapColor(v)).toEqual({ field: 'query' })
    v.setColorDomain(['chr2'])
    expect(snapColor(v)).toEqual({
      field: 'query',
      scale: { domain: ['chr2'] },
    })
    expect(v.colorDomain).toEqual(['chr2'])
  })
})

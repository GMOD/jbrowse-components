import { staysOpenOnClick } from '@jbrowse/core/ui'

import { getGroupByMenuItem } from './sortGroup.ts'

import type { AlignmentsUnit } from '../constants.ts'
import type { GroupByMenuModel } from './sortGroup.ts'

function makeModel(opts?: { field?: string; unit?: AlignmentsUnit }) {
  const facetByField = jest.fn()
  const model = {
    unit: opts?.unit ?? 'read',
    facet: opts?.field ? { field: opts.field, domain: [] } : undefined,
    facetByField,
  }
  return { model: model as unknown as GroupByMenuModel, facetByField }
}

// Dimensions only — the submenu is radios end to end (the collapse toggle moved
// to "Show", see `collapseSectionsItems`), so nothing needs filtering out.
function radios(model: GroupByMenuModel) {
  return getGroupByMenuItem(model).subMenu
}

test('offers None, the per-read dimensions, then Tag... last', () => {
  expect(radios(makeModel().model).map(i => i.label)).toEqual([
    'None',
    'Strand',
    'First-of-pair strand',
    'Pair orientation',
    'Pair status',
    'Split reads',
    'Spliced reads',
    'SV evidence',
    'Mapping quality',
    'Tag...',
  ])
})

test('chain mode offers only the fragment-level dimensions', () => {
  expect(radios(makeModel({ unit: 'chain' }).model).map(i => i.label)).toEqual([
    'None',
    'First-of-pair strand',
    'Pair orientation',
    'Pair status',
    'Split reads',
    'Spliced reads',
    'SV evidence',
    'Tag...',
  ])
})

test('ungrouped checks None', () => {
  expect(
    radios(makeModel().model)
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['None'])
})

test('the active dimension is the only one checked', () => {
  expect(
    radios(makeModel({ field: 'strand' }).model)
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['Strand'])
})

test('picking a per-read dimension sets it; picking None ungroups', () => {
  const { model, facetByField } = makeModel({ field: 'strand' })
  radios(model)
    .find(i => i.label === 'Split reads')!
    .onClick()
  expect(facetByField).toHaveBeenCalledWith('split')

  radios(model)
    .find(i => i.label === 'None')!
    .onClick()
  expect(facetByField).toHaveBeenCalledWith('')
})

// A stored per-read grouping that chain mode no longer offers degrades to
// ungrouped in the worker, so the menu should show None checked rather than a
// blank radio group.
test('a stored dimension not offered in chain mode falls back to None', () => {
  const items = radios(makeModel({ field: 'strand', unit: 'chain' }).model)
  expect(items.filter(i => i.checked).map(i => i.label)).toEqual(['None'])
})

// A `hidden` dimension has no radio here, but one a config stored still
// draws its sections, so ticking None claimed an ungrouped track.
test('a stored hidden dimension gets a checked, disabled radio', () => {
  const items = radios(makeModel({ field: 'mateAssembly' }).model)
  expect(items.filter(i => i.checked)).toMatchObject([
    { label: 'mateAssembly', disabled: true },
  ])
})

// A field only a config writes has no radio of its own to pick it from, so
// the menu adds one rather than ticking None over a grouped track, disabled
// since picking it again changes nothing.
test('a field no radio names gets a checked, disabled radio of its own', () => {
  const items = radios(makeModel({ field: 'sample' }).model)
  expect(items.map(i => i.label).slice(-2)).toEqual(['Tag...', 'sample'])
  expect(items.filter(i => i.checked).map(i => i.label)).toEqual(['sample'])
  expect(items.filter(i => 'disabled' in i && i.disabled)).toEqual([
    expect.objectContaining({ label: 'sample' }),
  ])
})

// The dimension radios write a value, so the menu stays up and the ticks move
// live; the tag row opens a dialog, so it has to dismiss it. Asserted through
// `staysOpenOnClick` rather than the flag: the row left `keepMenuOpen` unset,
// which the radio default turned back into "stay open", and the dialog opened
// behind two levels of standing menu.
test('dimension rows stay open, the tag row (a dialog) dismisses', () => {
  const rows = radios(makeModel().model)
  expect(rows.map(i => [i.label, staysOpenOnClick(i)])).toEqual(
    rows.map(i => [i.label, !String(i.label).startsWith('Tag')]),
  )
})

test('the tag radio ticks while a tag groups, and names no tag', () => {
  const items = radios(makeModel({ field: 'tags.RG' }).model)
  expect(items.filter(i => i.checked).map(i => i.label)).toEqual(['Tag...'])
})

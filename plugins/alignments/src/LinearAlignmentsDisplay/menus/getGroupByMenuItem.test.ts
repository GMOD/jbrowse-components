import { staysOpenOnClick } from '@jbrowse/core/ui'

import { getGroupByMenuItem } from './sortGroup.ts'

import type { GroupByType } from '../../shared/types.ts'
import type { GroupByMenuModel } from './sortGroup.ts'

function makeModel(opts?: {
  type?: GroupByType
  tag?: string
  isChainMode?: boolean
}) {
  const setGroupBy = jest.fn()
  const model = {
    isChainMode: opts?.isChainMode ?? false,
    groupBy: opts?.type ? { type: opts.type, tag: opts.tag } : undefined,
    setGroupBy,
  }
  return { model: model as unknown as GroupByMenuModel, setGroupBy }
}

// Dimensions only — the submenu is radios end to end (the collapse toggle moved
// to "Show...", see `collapseGroupRowsItems`), so nothing needs filtering out.
function radios(model: GroupByMenuModel) {
  return getGroupByMenuItem(model).subMenu
}

test('offers None, the per-read dimensions, then Tag... last', () => {
  expect(radios(makeModel().model).map(i => i.label)).toEqual([
    'None',
    'Strand',
    'First-of-pair strand',
    'Pair orientation',
    'Split read (SA tag)',
    'Mapping quality',
    'Tag...',
  ])
})

test('chain mode offers only the fragment-level dimensions', () => {
  expect(
    radios(makeModel({ isChainMode: true }).model).map(i => i.label),
  ).toEqual([
    'None',
    'First-of-pair strand',
    'Pair orientation',
    'Split read (SA tag)',
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
    radios(makeModel({ type: 'strand' }).model)
      .filter(i => i.checked)
      .map(i => i.label),
  ).toEqual(['Strand'])
})

test('picking a per-read dimension sets it; picking None ungroups', () => {
  const { model, setGroupBy } = makeModel({ type: 'strand' })
  radios(model)
    .find(i => i.label === 'Split read (SA tag)')!
    .onClick()
  expect(setGroupBy).toHaveBeenCalledWith({ type: 'splitRead' })

  radios(model)
    .find(i => i.label === 'None')!
    .onClick()
  expect(setGroupBy).toHaveBeenCalledWith(undefined)
})

// A stored per-read grouping that chain mode no longer offers degrades to
// ungrouped in the worker, so the menu should show None checked rather than a
// blank radio group.
test('a stored dimension not offered in chain mode falls back to None', () => {
  const items = radios(makeModel({ type: 'strand', isChainMode: true }).model)
  expect(items.filter(i => i.checked).map(i => i.label)).toEqual(['None'])
})

// `hidden` dimensions belong to another display's menu (mateAssembly is
// LGVSyntenyDisplay's), so this menu never offers them and must not leave the
// group blank when a config stored one.
test('a stored hidden dimension falls back to None', () => {
  const items = radios(makeModel({ type: 'mateAssembly' }).model)
  expect(items.filter(i => i.checked).map(i => i.label)).toEqual(['None'])
})

test('grouping by tag checks the Tag... radio', () => {
  const items = radios(makeModel({ type: 'tag' }).model)
  expect(items.filter(i => i.checked).map(i => i.label)).toEqual(['Tag...'])
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

// Like the sort and color menus' tag rows — otherwise the tag being grouped on
// is invisible without reopening the dialog.
test('the tag radio names the tag being grouped on', () => {
  const items = radios(makeModel({ type: 'tag', tag: 'RG' }).model)
  expect(items.filter(i => i.checked).map(i => i.label)).toEqual([
    'Tag (RG)...',
  ])
})

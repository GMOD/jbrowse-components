import { getGroupByMenuItem } from './sortGroup.ts'

import type { GroupByType } from '../../shared/types.ts'
import type { GroupByMenuModel } from './sortGroup.ts'

function makeModel(opts?: { type?: GroupByType; isChainMode?: boolean }) {
  const setGroupBy = jest.fn()
  const model = {
    isChainMode: opts?.isChainMode ?? false,
    groupBy: opts?.type ? { type: opts.type } : undefined,
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

test('chain mode offers only the chain-consistent dimensions', () => {
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

// No radio carries helpText: the menu reserves a help column across every row as
// soon as one does, and none of these dimensions needs a sentence to explain it.
test('the dimension radios need no help column', () => {
  expect(radios(makeModel().model).filter(i => i.helpText)).toEqual([])
})

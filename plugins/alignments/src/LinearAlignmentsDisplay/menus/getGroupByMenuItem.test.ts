import { getGroupByMenuItem } from './sortGroup.ts'

import type { GroupByType } from '../../shared/types.ts'
import type { GroupByModel } from '../dialogs/GroupByDialog.tsx'

function makeModel(opts?: {
  type?: GroupByType
  isChainMode?: boolean
  collapseGroupRows?: boolean
}) {
  const setGroupBy = jest.fn()
  const setCollapseGroupRows = jest.fn()
  const model = {
    isChainMode: opts?.isChainMode ?? false,
    groupBy: opts?.type ? { type: opts.type } : undefined,
    collapseGroupRows: opts?.collapseGroupRows ?? false,
    setGroupBy,
    setCollapseGroupRows,
  }
  return {
    model: model as unknown as GroupByModel,
    setGroupBy,
    setCollapseGroupRows,
  }
}

// The dimension radios only — the trailing "One row per group" checkbox is a
// layout toggle, not a dimension, and is asserted separately below.
function radios(model: GroupByModel) {
  return getGroupByMenuItem(model).subMenu.filter(i => i.type === 'radio')
}

test('offers None, the per-read dimensions, then Tag... last', () => {
  expect(radios(makeModel().model).map(i => i.label)).toEqual([
    'None',
    'Strand',
    'First-of-pair strand',
    'Pair orientation',
    'Supplementary',
    'Duplicate',
    'Mapping quality',
    'Tag...',
  ])
})

test('chain mode offers only the chain-consistent dimensions', () => {
  expect(
    radios(makeModel({ isChainMode: true }).model).map(i => i.label),
  ).toEqual(['None', 'First-of-pair strand', 'Pair orientation', 'Tag...'])
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
    .find(i => i.label === 'Supplementary')!
    .onClick()
  expect(setGroupBy).toHaveBeenCalledWith({ type: 'supplementary' })

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

function collapseItem(model: GroupByModel) {
  return getGroupByMenuItem(model)
    .subMenu.filter(i => i.type === 'checkbox')
    .find(i => i.label === 'One row per group')
}

test('the one-row-per-group toggle reflects and writes the setting', () => {
  const { model, setCollapseGroupRows } = makeModel({ collapseGroupRows: true })
  const item = collapseItem(model)!
  expect(item.checked).toBe(true)
  item.onClick()
  expect(setCollapseGroupRows).toHaveBeenCalledWith(false)
})

// A chain row is a chain; collapsing it would drop the connecting lines the
// mode exists for, so the layout refuses to collapse there (`collapsesRows`).
test('chain mode omits the one-row-per-group toggle', () => {
  expect(collapseItem(makeModel({ isChainMode: true }).model)).toBeUndefined()
})

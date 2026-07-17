import { getGroupByMenuItem } from './sortGroup.ts'

import type { GroupByType } from '../../shared/types.ts'
import type { GroupByModel } from '../dialogs/GroupByDialog.tsx'

function makeModel(opts?: { type?: GroupByType; isChainMode?: boolean }) {
  const setGroupBy = jest.fn()
  const model = {
    isChainMode: opts?.isChainMode ?? false,
    groupBy: opts?.type ? { type: opts.type } : undefined,
    setGroupBy,
  }
  return { model: model as unknown as GroupByModel, setGroupBy }
}

function radios(model: GroupByModel) {
  return getGroupByMenuItem(model).subMenu
}

test('offers None, the per-read dimensions, then Tag... last', () => {
  expect(radios(makeModel().model).map(i => i.label)).toEqual([
    'None',
    'Strand',
    'First-of-pair strand',
    'Pair orientation',
    'Supplementary',
    'Duplicate',
    'MAPQ (binned)',
    'Tag...',
  ])
})

test('chain mode offers only the chain-consistent dimensions', () => {
  expect(radios(makeModel({ isChainMode: true }).model).map(i => i.label)).toEqual(
    ['None', 'First-of-pair strand', 'Pair orientation', 'Tag...'],
  )
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

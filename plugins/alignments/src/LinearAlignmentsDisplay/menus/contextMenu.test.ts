import { getContextMenuItems } from './contextMenu.ts'

import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'

type SortCall = [type: string, pos: number, refName: string]

function makeModel(
  over: {
    contextMenuCigarHit?: CigarHitResult
    contextMenuIndicatorHit?: IndicatorHitResult
    contextMenuRefName?: string
  } = {},
) {
  const sortCalls: SortCall[] = []
  return {
    sortCalls,
    contextMenuFeature: undefined,
    contextMenuCigarHit: undefined,
    contextMenuIndicatorHit: undefined,
    contextMenuRefName: 'ctgA' as string | undefined,
    contextMenuRpcData: undefined,
    setSortedByAtPosition(type: string, pos: number, refName: string) {
      sortCalls.push([type, pos, refName])
    },
    selectFeature() {},
    ...over,
  }
}

// the model mock only needs to be structurally valid for the sort branch; the
// onClicks exercised here call the plain setSortedByAtPosition mock, not
// getSession/getContainingView
function run(model: ReturnType<typeof makeModel>) {
  return getContextMenuItems(model)
}

function firstSubMenuItem(item: unknown) {
  if (!item || typeof item !== 'object' || !('subMenu' in item)) {
    throw new Error('expected a subMenu item')
  }
  return (item as { subMenu: { onClick: () => void }[] }).subMenu[0]!
}

test('no hits yields an empty menu', () => {
  expect(run(makeModel())).toEqual([])
})

test('a base-pair cigar hit sorts by base at that position', () => {
  const model = makeModel({
    contextMenuCigarHit: { type: 'mismatch', index: 0, position: 42 },
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([['basePair', 42, 'ctgA']])
})

test('an interbase (insertion) cigar hit sorts by the interbase type', () => {
  const model = makeModel({
    contextMenuCigarHit: { type: 'insertion', index: 0, position: 7 },
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([['insertion', 7, 'ctgA']])
})

test('an indicator hit sorts by the indicator type', () => {
  const model = makeModel({
    contextMenuIndicatorHit: {
      type: 'indicator',
      position: 100,
      indicatorType: 'insertion',
    },
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([['insertion', 100, 'ctgA']])
})

test('sort is a no-op without a refName', () => {
  const model = makeModel({
    contextMenuCigarHit: { type: 'mismatch', index: 0, position: 42 },
    contextMenuRefName: undefined,
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([])
})

import { getContextMenuItems } from './contextMenu.ts'

import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { FilterBy } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

type SortCall = [type: string, pos: number, refName: string]

const defaultFilterBy: FilterBy = { flagInclude: 0, flagExclude: 1540 }

// A minimal Feature stand-in: only .get()/.id()/.toJSON() are exercised by the
// context menu, and unknown keys return undefined (so the mate branch is skipped
// unless next_ref/next_pos are supplied).
function makeFeature(fields: Record<string, unknown>): Feature {
  return {
    id: () => 'read1',
    get: (key: string) => fields[key],
    toJSON: () => ({ uniqueId: 'read1', ...fields }),
  } as unknown as Feature
}

function makeModel(
  over: {
    contextMenuCigarHit?: CigarHitResult
    contextMenuIndicatorHit?: IndicatorHitResult
    contextMenuRefName?: string
    contextMenuFeature?: Feature
    filterBy?: FilterBy
  } = {},
) {
  const sortCalls: SortCall[] = []
  const filterCalls: FilterBy[] = []
  return {
    sortCalls,
    filterCalls,
    contextMenuFeature: undefined as Feature | undefined,
    contextMenuCigarHit: undefined,
    contextMenuIndicatorHit: undefined,
    contextMenuRefName: 'ctgA' as string | undefined,
    contextMenuRpcData: undefined,
    filterBy: defaultFilterBy,
    setFilterBy(filterBy: FilterBy) {
      filterCalls.push(filterBy)
    },
    setSortedByAtPosition(type: string, pos: number, refName: string) {
      sortCalls.push([type, pos, refName])
    },
    selectFeature() {},
    ...over,
  }
}

function findSubMenu(items: unknown[], label: string) {
  const item = items.find(
    i => !!i && typeof i === 'object' && 'label' in i && i.label === label,
  )
  if (!item || !('subMenu' in item)) {
    throw new Error(`no subMenu labeled ${label}`)
  }
  return (item as { subMenu: { label: string; onClick: () => void }[] }).subMenu
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

test('filter for this read sets the read name (QNAME), keeping flags', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
  })
  const filter = findSubMenu(run(model), 'Filter')
  filter.find(i => i.label === 'Filter for this read')!.onClick()
  expect(model.filterCalls).toEqual([
    { flagInclude: 0, flagExclude: 1540, readName: 'readABC' },
  ])
})

test('haplotype/read-group tag filters read HP/RG off the feature', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({
      name: 'readABC',
      tags: { HP: 1, RG: 'lib1' },
    }),
  })
  const filter = findSubMenu(run(model), 'Filter')
  filter.find(i => i.label === 'Filter for this haplotype (HP:1)')!.onClick()
  filter
    .find(i => i.label === 'Filter for this read group (RG:lib1)')!
    .onClick()
  expect(model.filterCalls).toEqual([
    { flagInclude: 0, flagExclude: 1540, tagFilter: { tag: 'HP', value: '1' } },
    {
      flagInclude: 0,
      flagExclude: 1540,
      tagFilter: { tag: 'RG', value: 'lib1' },
    },
  ])
})

test('clear appears only when a read/tag filter is active and keeps flags', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
    filterBy: { flagInclude: 0, flagExclude: 1540, readName: 'readABC' },
  })
  const filter = findSubMenu(run(model), 'Filter')
  filter.find(i => i.label === 'Clear read/tag filters')!.onClick()
  expect(model.filterCalls).toEqual([{ flagInclude: 0, flagExclude: 1540 }])
})

test('no clear item without an active read/tag filter', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
  })
  const filter = findSubMenu(run(model), 'Filter')
  expect(filter.map(i => i.label)).not.toContain('Clear read/tag filters')
})

test('copy submenu offers name, sequence, and info when both are present', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC', seq: 'ACGTACGT' }),
  })
  const copy = findSubMenu(run(model), 'Copy')
  expect(copy.map(i => i.label)).toEqual([
    'Copy read name',
    'Copy read sequence',
    'Copy info to clipboard',
  ])
})

test('copy submenu omits read sequence when the feature has no seq', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
  })
  const copy = findSubMenu(run(model), 'Copy')
  expect(copy.map(i => i.label)).toEqual([
    'Copy read name',
    'Copy info to clipboard',
  ])
})

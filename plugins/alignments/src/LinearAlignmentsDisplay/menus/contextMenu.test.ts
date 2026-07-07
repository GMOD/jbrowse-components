import { getContextMenuItems } from './contextMenu.ts'

import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type {
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'
import type { FilterBy } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

type SortCall = [type: string, pos: number, refName: string]

const defaultFilterBy: FilterBy = { flagInclude: 0, flagExclude: 1540 }

// A minimal block under the right-click; only refName is read by the sort items.
function makeBlock(refName: string): ResolvedBlock {
  return {
    refName,
    rpcData: {} as ResolvedBlock['rpcData'],
    bpRange: [0, 0],
    blockStartPx: 0,
    blockWidth: 0,
    reversed: false,
  }
}

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
    contextMenuBlock?: ResolvedBlock
    contextMenuFeature?: Feature
    filterBy?: FilterBy
  } = {},
) {
  const sortCalls: SortCall[] = []
  const filterCalls: FilterBy[] = []
  const model = {
    sortCalls,
    filterCalls,
    contextMenuFeature: undefined as Feature | undefined,
    contextMenuCigarHit: undefined,
    contextMenuIndicatorHit: undefined,
    contextMenuBlock: makeBlock('ctgA') as ResolvedBlock | undefined,
    filterBy: defaultFilterBy,
    // Record every call and apply it, so successive quick-filter clicks read the
    // accumulated filterBy (the coexistence path this suite guards).
    setFilterBy(filterBy: FilterBy) {
      filterCalls.push(filterBy)
      model.filterBy = filterBy
    },
    setSortedByAtPosition(type: string, pos: number, refName: string) {
      sortCalls.push([type, pos, refName])
    },
    selectFeature() {},
    ...over,
  }
  return model
}

interface SubMenuItem {
  label: string
  subMenu?: { label: string; onClick: () => void }[]
}

function findSubMenu(items: unknown[], label: string) {
  const item = items.find(
    (i): i is SubMenuItem =>
      typeof i === 'object' && i !== null && 'label' in i && i.label === label,
  )
  if (!item?.subMenu) {
    throw new Error(`no subMenu labeled ${label}`)
  }
  return item.subMenu
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

// The menu closes (clearContextMenu) before the clicked item's callback runs,
// so an onClick that read model.contextMenuBlock live would see undefined and
// silently skip the sort. The item must capture the block when it's built.
test('sort still fires when the block is cleared before the click', () => {
  const model = makeModel({
    contextMenuCigarHit: { type: 'mismatch', index: 0, position: 42 },
  })
  const item = firstSubMenuItem(run(model)[0])
  model.contextMenuBlock = undefined
  item.onClick()
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

test('sort is a no-op without a block', () => {
  const model = makeModel({
    contextMenuCigarHit: { type: 'mismatch', index: 0, position: 42 },
    contextMenuBlock: undefined,
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

test('haplotype and read-group tag filters coexist instead of clobbering', () => {
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
    {
      flagInclude: 0,
      flagExclude: 1540,
      tagFilters: [{ tag: 'HP', value: '1' }],
    },
    {
      flagInclude: 0,
      flagExclude: 1540,
      tagFilters: [
        { tag: 'HP', value: '1' },
        { tag: 'RG', value: 'lib1' },
      ],
    },
  ])
})

test('re-filtering the same tag replaces its value, not duplicates', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC', tags: { HP: 2 } }),
    filterBy: {
      flagInclude: 0,
      flagExclude: 1540,
      tagFilters: [{ tag: 'HP', value: '1' }],
    },
  })
  findSubMenu(run(model), 'Filter')
    .find(i => i.label === 'Filter for this haplotype (HP:2)')!
    .onClick()
  expect(model.filterCalls).toEqual([
    {
      flagInclude: 0,
      flagExclude: 1540,
      tagFilters: [{ tag: 'HP', value: '2' }],
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
    'Copy feature info',
  ])
})

test('copy submenu omits read sequence when the feature has no seq', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
  })
  const copy = findSubMenu(run(model), 'Copy')
  expect(copy.map(i => i.label)).toEqual([
    'Copy read name',
    'Copy feature info',
  ])
})

test('copy submenu includes 1-based location when the feature has a refName', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({
      name: 'readABC',
      refName: 'chr1',
      start: 99,
      end: 200,
    }),
  })
  const copy = findSubMenu(run(model), 'Copy')
  expect(copy.map(i => i.label)).toEqual([
    'Copy read name',
    'Copy location',
    'Copy feature info',
  ])
})

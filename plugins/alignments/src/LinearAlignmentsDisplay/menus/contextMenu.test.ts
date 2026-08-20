import { getContextMenuItems, getHitMenuItems } from './contextMenu.ts'

import type { CoverageHitResult } from '../../features/coverage/types.ts'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type {
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'
import type { FilterBy } from '../../shared/types.ts'
import type { ContextMenuHit } from '../components/hitTestPipeline.ts'
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
    cigarHit?: CigarHitResult
    indicatorHit?: IndicatorHitResult
    modHit?: ModificationHitResult
    coverageHit?: CoverageHitResult
    // The clicked column. Defaults to the mark's own position — a right-click
    // normally lands ON what it hits — so only a test that deliberately clicks
    // away from the mark (inside a long deletion, beside an insertion) has to
    // say so.
    genomicPos?: number
    // A right-click the pipeline resolved nothing for, which is the only way
    // there is no block: the hit and its block arrive together or not at all.
    noHit?: boolean
    contextMenuFeature?: Feature
    contextMenuFeatureId?: string
    filterBy?: FilterBy
  } = {},
) {
  const sortCalls: SortCall[] = []
  const filterCalls: FilterBy[] = []
  const selected: Feature[] = []
  const {
    cigarHit,
    indicatorHit,
    modHit,
    coverageHit,
    genomicPos,
    noHit,
    ...rest
  } = over
  const model = {
    sortCalls,
    filterCalls,
    // What each "open the details" path acted on: a Feature when the fetched
    // feature was in hand, the id when the menu had to resolve it.
    selected,
    contextMenuFeature: undefined as Feature | undefined,
    // A read under the cursor always has an id — the hit test carries it, and
    // the feature only follows an RPC later — so a mock holding a feature and no
    // id is a state the display can't be in. Default it from the feature rather
    // than restating it in every case.
    contextMenuFeatureId: (over.contextMenuFeature ? 'read1' : undefined) as
      | string
      | undefined,
    contextMenuHit: noHit
      ? undefined
      : ({
          block: makeBlock('ctgA'),
          genomicPos:
            genomicPos ??
            cigarHit?.position ??
            indicatorHit?.position ??
            coverageHit?.position ??
            0,
          cigarHit,
          indicatorHit,
          modHit,
          coverageHit,
        } as ContextMenuHit | undefined),
    filterBy: defaultFilterBy,
    // Record every call and apply it, so successive quick-filter clicks read the
    // accumulated filterBy (the coexistence path this suite guards).
    setFilterBy(filterBy: FilterBy) {
      filterCalls.push(filterBy)
      model.filterBy = filterBy
    },
    setSortedByAtPosition(arg: { type: string; pos: number; refName: string }) {
      sortCalls.push([arg.type, arg.pos, arg.refName])
    },
    selectFeature(feature: Feature) {
      selected.push(feature)
    },
    // Stands in for the RPC, resolving to a feature the assertions can tell
    // apart from one the menu already had in hand.
    withFeatureById(_featureId: string, onFeat: (feat: Feature) => void) {
      onFeat(makeFeature({ name: 'fetched' }))
      return Promise.resolve()
    },
    ...rest,
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

function click(item: unknown) {
  ;(item as { onClick: () => void }).onClick()
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
    cigarHit: {
      type: 'mismatch',
      index: 0,
      position: 42,
      length: 1,
    },
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([['basePair', 42, 'ctgA']])
})

// The menu closes (closeContextMenu) before the clicked item's callback runs,
// so an onClick that read model.contextMenuHit live would see undefined and
// silently skip the sort. The item must capture the hit when it's built.
test('sort still fires when the hit is cleared before the click', () => {
  const model = makeModel({
    cigarHit: {
      type: 'mismatch',
      index: 0,
      position: 42,
      length: 1,
    },
  })
  const item = firstSubMenuItem(run(model)[0])
  model.contextMenuHit = undefined
  item.onClick()
  expect(model.sortCalls).toEqual([['basePair', 42, 'ctgA']])
})

// A deletion/skip reports `position` as the op's START, which for a 5kb
// deletion or a 100kb intron can be off screen — and it disagreed with the read
// menu's own "Sort by ▸ Base pair" in the same menu, which has always meant the
// clicked column. A base-pair sort anchors on the column.
describe('a gap cigar hit sorts at the clicked column, not the gap start', () => {
  test('deletion', () => {
    const model = makeModel({
      cigarHit: {
        type: 'deletion',
        index: 0,
        position: 28498,
        length: 4860,
      },
      genomicPos: 30000,
    })
    firstSubMenuItem(run(model)[0]).onClick()
    expect(model.sortCalls).toEqual([['basePair', 30000, 'ctgA']])
  })

  test('skip', () => {
    const model = makeModel({
      cigarHit: {
        type: 'skip',
        index: 0,
        position: 100,
        length: 900,
      },
      genomicPos: 550,
    })
    firstSubMenuItem(run(model)[0]).onClick()
    expect(model.sortCalls).toEqual([['basePair', 550, 'ctgA']])
  })

  // The two "sort by base pair" rows a gap right-click puts in one menu — the
  // gap submenu's and the read's — must now name the same base.
  test('agrees with the read menu Sort by ▸ Base pair', () => {
    const model = makeModel({
      cigarHit: {
        type: 'deletion',
        index: 0,
        position: 28498,
        length: 4860,
      },
      genomicPos: 30000,
      contextMenuFeature: makeFeature({ name: 'readABC' }),
    })
    const items = run(model)
    firstSubMenuItem(items[0]).onClick()
    findSubMenu(items, 'Sort by')
      .find(i => i.label === 'Base pair')!
      .onClick()
    expect(model.sortCalls).toEqual([
      ['basePair', 30000, 'ctgA'],
      ['basePair', 30000, 'ctgA'],
    ])
  })
})

// A mismatch is 1bp, so its own position IS the clicked column — the anchor
// swap above must not move it.
test('a mismatch still sorts at its own base', () => {
  const model = makeModel({
    cigarHit: {
      type: 'mismatch',
      index: 0,
      position: 42,
      length: 1,
    },
    genomicPos: 42,
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([['basePair', 42, 'ctgA']])
})

test('an interbase (insertion) cigar hit sorts by the interbase type', () => {
  const model = makeModel({
    cigarHit: {
      type: 'insertion',
      index: 0,
      position: 7,
      length: 3,
    },
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([['insertion', 7, 'ctgA']])
})

// An interbase mark IS its position — the sort groups reads by whether they
// carry one there — so it keeps anchoring on the mark, not on wherever inside
// its hit tolerance the cursor happened to land.
test('an interbase hit anchors on the mark even with a clicked column', () => {
  const model = makeModel({
    cigarHit: {
      type: 'insertion',
      index: 0,
      position: 7,
      length: 3,
    },
    genomicPos: 9,
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([['insertion', 7, 'ctgA']])
})

test('an indicator hit sorts by the indicator type', () => {
  const model = makeModel({
    indicatorHit: {
      type: 'indicator',
      position: 100,
      indicatorType: 'insertion',
    },
  })
  firstSubMenuItem(run(model)[0]).onClick()
  expect(model.sortCalls).toEqual([['insertion', 100, 'ctgA']])
})

// The depth histogram had a left-click widget and no right-click menu at all,
// so the one sort a reader points at a coverage bar to ask for had nowhere to
// be asked from.
describe('a coverage hit', () => {
  const coverageHit = { type: 'coverage', position: 500 } as const

  test('sorts by base at the bar under the cursor, and opens its details', () => {
    const model = makeModel({ coverageHit })
    const sub = findSubMenu(run(model), 'Coverage')
    expect(sub.map(i => i.label)).toEqual([
      'Sort by base at position',
      'Open coverage details',
    ])
    sub[0]!.onClick()
    expect(model.sortCalls).toEqual([['basePair', 500, 'ctgA']])
  })

  // Zoomed out, hitTestCoverage snaps to a significant SNP inside the bin — the
  // column a reader pointing at a coloured bar means — so the sort anchors on
  // the hit rather than on the raw cursor column.
  test('anchors on the snapped bin position, not the raw column', () => {
    const model = makeModel({ coverageHit, genomicPos: 512 })
    firstSubMenuItem(run(model)[0]).onClick()
    expect(model.sortCalls).toEqual([['basePair', 500, 'ctgA']])
  })

  test('sort: false leaves the details reachable on its own', () => {
    const items = getHitMenuItems(makeModel({ coverageHit }), { sort: false })
    expect(items.map(i => (i as { label?: string }).label)).toEqual([
      'Open coverage details',
    ])
  })
})

test('a modification hit offers "Open modification details"', () => {
  const model = makeModel({
    modHit: {
      position: 100,
      modType: 'm',
      noMod: false,
      probability: 0.9,
      color: 'rgb(255,0,0)',
    },
  })
  const labels = run(model).map(i => (i as { label?: string }).label)
  expect(labels).toContain('Open modification details')
})

// Every hit item names the block's refName, so without a hit there is nothing
// to offer — the alternative (a visible row whose click silently does nothing)
// is what this replaced.
test('no hit items without a hit', () => {
  const model = makeModel({
    cigarHit: {
      type: 'mismatch',
      index: 0,
      position: 42,
      length: 1,
    },
    noHit: true,
  })
  expect(run(model)).toEqual([])
})

test('a read hit offers a "Sort by" submenu anchored at the clicked column', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
    genomicPos: 150,
  })
  const sortBy = findSubMenu(run(model), 'Sort by')
  expect(sortBy.map(i => i.label)).toEqual([
    'Read strand',
    'Base pair',
    'Tag...',
  ])

  sortBy.find(i => i.label === 'Read strand')!.onClick()
  sortBy.find(i => i.label === 'Base pair')!.onClick()
  expect(model.sortCalls).toEqual([
    ['strand', 150, 'ctgA'],
    ['basePair', 150, 'ctgA'],
  ])
})

test('the read "Sort by" fires after the block is cleared (captured pos/refName)', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
    genomicPos: 150,
  })
  const sortBy = findSubMenu(run(model), 'Sort by')
  const strand = sortBy.find(i => i.label === 'Read strand')!
  model.contextMenuHit = undefined
  strand.onClick()
  expect(model.sortCalls).toEqual([['strand', 150, 'ctgA']])
})

// A read hit always resolves a block and a column together, so the only way to
// reach the read menu without them is a hit the pipeline never produced.
test('no "Sort by" submenu without a resolved hit', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
    noHit: true,
  })
  expect(run(model).map(i => (i as { label: string }).label)).not.toContain(
    'Sort by',
  )
})

// Chain layout is handed no `sortedBy`, so the display curates every
// position-anchored sort out — the read submenu here alongside the hit ones,
// and the track menu's "Sort by..." alongside both.
test('sort: false drops the read "Sort by" but keeps the rest', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
    genomicPos: 150,
  })
  const labels = getContextMenuItems(model, { sort: false }).map(
    i => (i as { label?: string }).label,
  )
  expect(labels).not.toContain('Sort by')
  expect(labels).toContain('Open feature details')
  expect(labels).toContain('Copy')
})

// The menu opens on the id and grows the rest when the fetch lands. Everything
// answerable from the id has to be in that first paint — the details item and
// the position sort, which reads only the clicked block and column. Anything
// that reads a read field (mate, tags, name, sequence) can only come later.
describe('what the menu offers before the feature fetch lands', () => {
  test('details and sort are there from the id alone', () => {
    const model = makeModel({
      contextMenuFeatureId: 'read1',
      genomicPos: 150,
    })
    const labels = run(model).map(i => (i as { label?: string }).label)
    expect(labels).toEqual(['Open feature details', 'Sort by'])
  })

  test('the read-field items are absent until it does', () => {
    const withFeat = run(
      makeModel({
        contextMenuFeature: makeFeature({ name: 'readABC' }),
        genomicPos: 150,
      }),
    ).map(i => (i as { label?: string }).label)
    expect(withFeat).toEqual([
      'Open feature details',
      'Sort by',
      'Filter',
      'Copy',
    ])
  })

  // One item, two paths to the same read: it fetches when clicked before the
  // feature landed, and acts on the one in hand when clicked after.
  test('"Open feature details" fetches by id, or uses the landed feature', () => {
    const pending = makeModel({ contextMenuFeatureId: 'read1' })
    click(run(pending)[0])
    expect(pending.selected.map(f => f.get('name'))).toEqual(['fetched'])

    const feature = makeFeature({ name: 'readABC' })
    const landed = makeModel({ contextMenuFeature: feature })
    click(run(landed)[0])
    expect(landed.selected).toEqual([feature])
  })
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
    'Copy feature info as JSON',
  ])
})

test('copy submenu omits read sequence when the feature has no seq', () => {
  const model = makeModel({
    contextMenuFeature: makeFeature({ name: 'readABC' }),
  })
  const copy = findSubMenu(run(model), 'Copy')
  expect(copy.map(i => i.label)).toEqual([
    'Copy read name',
    'Copy feature info as JSON',
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
    'Copy feature info as JSON',
  ])
})

// LGVSyntenyDisplay reuses the hit items but curates the sort out (its own
// "Sort by..." menu offers no position-anchored mode), so each hit collapses
// from a submenu to the bare details item.
describe('getHitMenuItems with sort: false', () => {
  test('a cigar hit becomes a flat details item', () => {
    const items = getHitMenuItems(
      makeModel({
        cigarHit: {
          type: 'mismatch',
          index: 0,
          position: 42,
          length: 1,
        },
      }),
      { sort: false },
    )
    expect(items.map(i => (i as { label?: string }).label)).toEqual([
      'Open snp/mismatch details',
    ])
    expect(items.every(i => !('subMenu' in i))).toBe(true)
  })

  // Beside a feature-level "Open feature details", a bare "Open deletion
  // details" doesn't say what it is the details of. The span does.
  test('a sized cigar hit names its span, a single base does not', () => {
    const sized = getHitMenuItems(
      makeModel({
        cigarHit: {
          type: 'deletion',
          index: 0,
          position: 28498,
          length: 4860,
        },
      }),
      { sort: false },
    )
    expect(sized.map(i => (i as { label?: string }).label)).toEqual([
      'Open deletion details (4,860 bp)',
    ])

    const oneBase = getHitMenuItems(
      makeModel({
        cigarHit: {
          type: 'insertion',
          index: 0,
          position: 42,
          length: 1,
        },
      }),
      { sort: false },
    )
    expect(oneBase.map(i => (i as { label?: string }).label)).toEqual([
      'Open insertion details',
    ])
  })

  test('an indicator hit still reaches its details, with no sort peer', () => {
    const items = getHitMenuItems(
      makeModel({
        indicatorHit: {
          type: 'indicator',
          position: 100,
          indicatorType: 'insertion',
        },
      }),
      { sort: false },
    )
    expect(items.map(i => (i as { label?: string }).label)).toEqual([
      'Open insertion details',
    ])
  })
})

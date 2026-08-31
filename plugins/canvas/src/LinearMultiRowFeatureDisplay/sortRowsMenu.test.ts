import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// "Sort rows by color here" is the interactive twin of the declarative
// `sortRowsBy` prop, and the two meet the "is the data here?" condition
// differently: the prop WAITS for the region (setupRowSortAutorun), a click
// cannot. What made that gap matter is that the empty result is destructive
// rather than inert — `setLayout` drops the cluster tree whenever the row set
// changes.

const SORT = 'Sort rows by color here'

// The rows this display draws are DISCOVERED from the loaded features
// (`sourcesWithoutLayout` is the distinct partitionField values across
// rpcDataMap), so they vanish whenever the display has no data loaded.
//
// `feats` are `[rowIndexIntoPartitionValues, color]` spanning the whole loaded
// window — enough for the sort to have something to rank by, and nothing more.
function regionData(
  partitionValues: string[],
  feats: [row: number, color: number][] = [],
): MultiRowRegionData {
  return {
    partitionValues,
    featureStarts: new Uint32Array(feats.length),
    featureEnds: Uint32Array.from(feats, () => 10_000),
    featureColors: Uint32Array.from(feats, f => f[1]),
    featurePartitionIndex: Uint32Array.from(feats, f => f[0]),
    featureNames: feats.map(() => ''),
    featureIds: feats.map((_, i) => `f${i}`),
    featureDeltas: new Int32Array(0),
    usedItemRgb: false,
    partitionCandidates: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// the `'onClick' in item` narrowing is what drops the label-less and
// unclickable members of the MenuItem union (dividers, subheaders), so the
// caller can read the row's own `disabled`/`disabledHelpText`
function row(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (!item || !('onClick' in item)) {
    throw new Error(`no clickable menu row "${label}"`)
  }
  return item
}

const LOADED = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function clustered() {
  const { display } = createTestEnvironment().createDisplay()
  display.setRpcData(0, regionData(['a', 'b', 'c']))
  // the span the sort resolves its column against — a click always lands in
  // one, so a test that omits it is testing the declining path by accident
  display.setLoadedRegion(0, LOADED)
  display.setLayoutAndClusterTree(
    [{ name: 'c' }, { name: 'a' }, { name: 'b' }],
    '((c,a),b);',
  )
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    refName: 'ctgA',
    pos: 100,
  })
  return display
}

describe('"Sort rows by color here"', () => {
  it('is live while there are rows to order', () => {
    const display = clustered()

    expect(row(display.contextMenuItems(), SORT).disabled).toBeFalsy()
  })

  it('is disabled, and says why, once the row set is empty', () => {
    const display = clustered()
    // panned off the track's features, or blanked by the density gate
    display.clearAllRpcData()

    const item = row(display.contextMenuItems(), SORT)
    expect(item.disabled).toBe(true)
    expect(item.disabledHelpText).toBe('Needs at least two rows to sort')
  })

  // The bug: the row was live, the click wrote the empty sort result, and
  // `setLayout` read the row-set change as a reason to drop the dendrogram. A
  // slow clustering run was discarded by a menu item that claimed to sort.
  it('leaves the arrangement and the cluster tree alone with no rows', () => {
    const display = clustered()
    display.clearAllRpcData()

    display.sortRowsByValueAt('ctgA', 100)

    expect(display.clusterTree).toBe('((c,a),b);')
    expect(display.layout.map(s => s.name)).toEqual(['c', 'a', 'b'])
  })

  // One surviving row reorders to itself, so the sort is a no-op — but writing
  // it is still a row-set change, and still took the tree with it.
  it('leaves them alone when only one row survives', () => {
    const display = clustered()
    display.clearAllRpcData()
    display.setRpcData(0, regionData(['b']))
    display.setLoadedRegion(0, LOADED)

    expect(display.editableSources.map(s => s.name)).toEqual(['b'])
    display.sortRowsByValueAt('ctgA', 100)

    expect(display.clusterTree).toBe('((c,a),b);')
    expect(display.layout.map(s => s.name)).toEqual(['c', 'a', 'b'])
  })

  // The other half of the same rule, and the one this display used to be
  // missing: rows aplenty, but the column is off the end of what was fetched,
  // so there is nothing to rank by. It filtered the regions on refName alone,
  // so every row came back valueless and the unchanged order was written back
  // as an explicit `layout`. Same gate `setupRowSortAutorun` and multi-wiggle
  // already applied.
  it('declines a column no loaded region covers', () => {
    const display = clustered()

    display.sortRowsByValueAt('ctgA', 50_000)
    expect(display.layout.map(s => s.name)).toEqual(['c', 'a', 'b'])

    display.sortRowsByValueAt('ctgB', 100)
    expect(display.layout.map(s => s.name)).toEqual(['c', 'a', 'b'])
  })

  it('still sorts, and still clears a now-stale tree, with rows loaded', () => {
    const display = clustered()

    display.sortRowsByValueAt('ctgA', 100)

    // no features at that position, so every row sorts to its existing index —
    // the order is unchanged, which is why the tree still describes it
    expect(display.layout.map(s => s.name)).toEqual(['c', 'a', 'b'])
    expect(display.clusterTree).toBe('((c,a),b);')
  })

  // The path every case above reaches only as a no-op: rows that actually move.
  // The clustered order is c,a,b; `a` and `b` share a color at the column and
  // `c` is alone, so the two-row block leads — in ITS incoming order, which is
  // what keeps a previous sort meaningful inside each block — and the tree
  // stops describing the rows.
  it('pulls the commonest block to the top, and drops the stale tree', () => {
    const display = clustered()
    display.setRpcData(
      0,
      regionData(
        ['a', 'b', 'c'],
        [
          [0, 0xff0000ff],
          [1, 0xff0000ff],
          [2, 0xff00ff00],
        ],
      ),
    )
    expect(display.editableSources.map(s => s.name)).toEqual(['c', 'a', 'b'])

    display.sortRowsByValueAt('ctgA', 100)

    expect(display.layout.map(s => s.name)).toEqual(['a', 'b', 'c'])
    expect(display.clusterTree).toBeUndefined()
  })
})

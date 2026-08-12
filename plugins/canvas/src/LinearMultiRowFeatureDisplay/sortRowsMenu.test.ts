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
function regionData(partitionValues: string[]): MultiRowRegionData {
  return {
    partitionValues,
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    featureDeltas: new Int32Array(0),
    usedItemRgb: false,
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

function clustered() {
  const { display } = createTestEnvironment().createDisplay()
  display.setRpcData(0, regionData(['a', 'b', 'c']))
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

    expect(display.editableSources.map(s => s.name)).toEqual(['b'])
    display.sortRowsByValueAt('ctgA', 100)

    expect(display.clusterTree).toBe('((c,a),b);')
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
})

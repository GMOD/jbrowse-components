import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// "Sort rows by color here" cannot wait for the region the way the declarative
// `sortRowsBy` does, and the empty result is destructive rather than inert:
// `setLayout` drops the cluster tree whenever the row set changes.

const SORT = 'Sort rows by color here'

// The rows this display draws are discovered from the loaded features, so they
// vanish whenever the display has no data loaded.
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
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// The `'onClick' in item` narrowing drops the label-less and unclickable
// members of the MenuItem union, so the caller can read the row's own
// `disabled`/`disabledHelpText`.
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
  // Loaded, not the whole contig: the span the sort resolves its column
  // against, so `50_000` below really is off the end of what was fetched.
  display.setRpcData(0, regionData(['a', 'b', 'c']), LOADED)
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
    // Panned off the track's features, or blanked by the density gate.
    display.clearAllRpcData()

    const item = row(display.contextMenuItems(), SORT)
    expect(item.disabled).toBe(true)
    expect(item.disabledHelpText).toBe('Needs at least two rows to sort')
  })

  // With the row live, the click writes the empty sort result and `setLayout`
  // reads the row-set change as a reason to drop the dendrogram.
  it('leaves the arrangement and the cluster tree alone with no rows', () => {
    const display = clustered()
    display.clearAllRpcData()

    display.sortRowsByValueAt('ctgA', 100)

    expect(display.clusterTree).toBe('((c,a),b);')
    expect(display.layout.map(s => s.name)).toEqual(['c', 'a', 'b'])
  })

  // One surviving row reorders to itself, so the sort is a no-op — but writing
  // it is still a row-set change.
  it('leaves them alone when only one row survives', () => {
    const display = clustered()
    display.clearAllRpcData()
    display.setRpcData(0, regionData(['b']), LOADED)

    expect(display.editableSources.map(s => s.name)).toEqual(['b'])
    display.sortRowsByValueAt('ctgA', 100)

    expect(display.clusterTree).toBe('((c,a),b);')
    expect(display.layout.map(s => s.name)).toEqual(['c', 'a', 'b'])
  })

  // Rows aplenty, but the column is off the end of what was fetched, so there
  // is nothing to rank by and the unchanged order must not be written back as
  // an explicit `layout`.
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

    // No features at that position, so every row sorts to its existing index
    // and the tree still describes the order.
    expect(display.layout.map(s => s.name)).toEqual(['c', 'a', 'b'])
    expect(display.clusterTree).toBe('((c,a),b);')
  })

  // Rows that actually move: the clustered order is c,a,b, `a` and `b` share a
  // color at the column and `c` is alone, so the two-row block leads in its own
  // incoming order and the tree stops describing the rows.
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
      LOADED,
    )
    expect(display.editableSources.map(s => s.name)).toEqual(['c', 'a', 'b'])

    display.sortRowsByValueAt('ctgA', 100)

    expect(display.layout.map(s => s.name)).toEqual(['a', 'b', 'c'])
    expect(display.clusterTree).toBeUndefined()
  })
})

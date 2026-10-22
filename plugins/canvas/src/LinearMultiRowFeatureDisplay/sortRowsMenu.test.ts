import { createTestEnvironment, stubColumnValues } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// "Sort rows by ... here" cannot wait for the region the way the declarative
// `sortRowsBy` does, and the empty result is destructive rather than inert:
// `setRowOrder` drops the cluster tree whenever the row set changes.

// These rows carry no attribute to compare, so the sort reads presence.
const SORT = 'Sort rows by presence here'

// The rows this display draws are discovered from the loaded features, so they
// vanish whenever the display has no data loaded.
function regionData(rowValues: string[]): MultiRowRegionData {
  return {
    rowValues,
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    rectColorValues: new Uint32Array(0),
    featureRowValueIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    fieldNames: [],
    rowsFieldCandidateValues: [],
    legendCandidates: [],
    resolvedRowsField: 'name',
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
  display.setRowOrder([{ name: 'c' }, { name: 'a' }, { name: 'b' }], {
    tree: '((c,a),b);',
  })
  display.openContextMenu({
    clientX: 0,
    clientY: 0,
    refName: 'ctgA',
    pos: 100,
  })
  return display
}

describe('"Sort rows by ... here"', () => {
  it('is live while there are rows to order', () => {
    const display = clustered()

    expect(row(display.contextMenuItems(), SORT).disabled).toBeFalsy()
  })

  it('names the attribute clustering compares rows on', () => {
    const display = clustered()
    display.setClusterField('state')

    expect(
      row(display.contextMenuItems(), 'Sort rows by state here').disabled,
    ).toBeFalsy()
  })

  it('is disabled, and says why, once the row set is empty', () => {
    const display = clustered()
    // Panned off the track's features, or blanked by the density gate.
    display.clearAllRpcData()

    const item = row(display.contextMenuItems(), SORT)
    expect(item.disabled).toBe(true)
    expect(item.disabledHelpText).toBe('Needs at least two rows to sort')
  })

  // With the row live, the click writes the empty sort result and `setRowOrder`
  // reads the row-set change as a reason to drop the dendrogram.
  it('leaves the arrangement and the cluster tree alone with no rows', async () => {
    const display = clustered()
    display.clearAllRpcData()
    const call = stubColumnValues(display, {})

    expect(await display.sortRowsByValueAt('ctgA', 100)).toBe(false)

    expect(call).not.toHaveBeenCalled()
    expect(display.rowTree).toBe('((c,a),b);')
    expect(display.rowDomain).toEqual(['c', 'a', 'b'])
  })

  // One surviving row reorders to itself, so the sort is a no-op — but writing
  // it is still a row-set change.
  it('leaves them alone when only one row survives', async () => {
    const display = clustered()
    display.clearAllRpcData()
    display.setRpcData(0, regionData(['b']), LOADED)
    stubColumnValues(display, {})

    expect(display.editableSources.map(s => s.name)).toEqual(['b'])
    expect(await display.sortRowsByValueAt('ctgA', 100)).toBe(false)

    expect(display.rowTree).toBe('((c,a),b);')
    expect(display.rowDomain).toEqual(['c', 'a', 'b'])
  })

  // Rows aplenty, but the column is off the end of what was fetched, so there
  // is nothing to rank by and the unchanged order must not be written back as
  // an explicit `rows.domain`.
  it('declines a column no loaded region covers', async () => {
    const display = clustered()
    const call = stubColumnValues(display, {})

    expect(await display.sortRowsByValueAt('ctgA', 50_000)).toBe(false)
    expect(await display.sortRowsByValueAt('ctgB', 100)).toBe(false)

    expect(call).not.toHaveBeenCalled()
    expect(display.rowDomain).toEqual(['c', 'a', 'b'])
  })

  it('keeps the order and the tree where no row has a feature there', async () => {
    const display = clustered()
    stubColumnValues(display, {})

    expect(await display.sortRowsByValueAt('ctgA', 100)).toBe(true)

    expect(display.rowDomain).toEqual(['c', 'a', 'b'])
    expect(display.rowTree).toBe('((c,a),b);')
  })

  it('a newer sort supersedes one still in flight', async () => {
    const display = clustered()
    const call = stubColumnValues(display, { a: '1', b: '2', c: '3' })

    const first = display.sortRowsByValueAt('ctgA', 100)
    const second = display.sortRowsByValueAt('ctgA', 200)

    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(call).toHaveBeenCalledTimes(2)
    expect(display.rowDomain).toEqual(['c', 'b', 'a'])
  })

  // Rows that actually move: the clustered order is c,a,b, `a` and `b` share a
  // value at the column and `c` is alone, so the two-row block leads in its own
  // incoming order and the tree stops describing the rows.
  it('pulls the commonest block to the top, and drops the stale tree', async () => {
    const display = clustered()
    display.setClusterField('state')
    const call = stubColumnValues(display, { a: 'Enh', b: 'Enh', c: 'TssA' })

    expect(await display.sortRowsByValueAt('ctgA', 100)).toBe(true)

    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({
        pos: 100,
        clusterField: 'state',
        rowsField: 'name',
        regions: [expect.objectContaining({ start: 100, end: 101 })],
      }),
    )
    expect(display.rowDomain).toEqual(['a', 'b', 'c'])
    expect(display.rowTree).toBeUndefined()
  })
})

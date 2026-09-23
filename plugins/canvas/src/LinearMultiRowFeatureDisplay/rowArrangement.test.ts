import { leaves } from '@jbrowse/tree-sidebar/hierarchy'

import { createTestEnvironment, ctgA, ctgB } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// The rows this display draws are discovered from the loaded features, not
// declared, so the row set grows as regions load with no action to hook an
// invalidation onto.
function regionData(
  partitionValues: string[],
  partitionCandidates: string[] = [],
  resolvedPartitionField = 'name',
): MultiRowRegionData {
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
    partitionCandidates,
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField,
  }
}

function rowNames(display: { sources: { name: string }[] }) {
  return display.sources.map(s => s.name)
}

describe('the dendrogram positions only while it describes the rows', () => {
  it('positions against a clustered order', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b', 'c']), ctgA)
    display.setRowOrder([{ name: 'c' }, { name: 'a' }, { name: 'b' }], {
      tree: '((c,a),b);',
    })

    expect(rowNames(display)).toEqual(['c', 'a', 'b'])
    expect(display.hierarchy).toBeDefined()
  })

  // Three 5 px rows are 15 px of content in a track floored at 20 px, and the
  // leaves belong on the rows, not spread over the floor.
  it('puts each leaf on its row where the track is taller than the rows', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b', 'c']), ctgA)
    display.setRowOrder([{ name: 'c' }, { name: 'a' }, { name: 'b' }], {
      tree: '((c,a),b);',
    })
    display.setRowHeight(5)

    expect(display.height).toBeGreaterThan(15)
    const rowCenters = leaves(display.hierarchy!)
      .map(leaf => leaf.x)
      .sort((p, q) => p - q)
    expect(rowCenters).toEqual([2.5, 7.5, 12.5])
  })

  // No `setRowOrder` call happens here: the rows move because a later region
  // revealed a partition value the clustering run never saw.
  it('stops positioning when a later region widens the row set', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b', 'c']), ctgA)
    display.setRowOrder([{ name: 'c' }, { name: 'a' }, { name: 'b' }], {
      tree: '((c,a),b);',
    })

    display.setRpcData(1, regionData(['a', 'd']), ctgB)

    expect(rowNames(display)).toEqual(['c', 'a', 'b', 'd'])
    expect(display.rowTree).toBe('((c,a),b);')
    expect(display.hierarchy).toBeUndefined()
  })
})

describe('repartitioning', () => {
  it('offers the names the loaded regions carry, unioned and sorted', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.partitionCandidates).toEqual([])

    display.setRpcData(0, regionData(['a'], ['repFamily', 'repClass']), ctgA)
    display.setRpcData(1, regionData(['b'], ['repClass', 'strain']), ctgB)

    expect(display.partitionCandidates).toEqual([
      'repClass',
      'repFamily',
      'strain',
    ])
  })

  // The slot is empty by default and the worker picks the column, so the menu's
  // checked radio names a field nothing in the config does.
  it('reports the field the worker actually partitioned on', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.rowsField).toBe('')
    expect(display.effectivePartitionField).toBe('name')

    display.setRpcData(
      0,
      regionData(['LINE'], ['repClass', 'name'], 'repClass'),
      ctgA,
    )

    expect(display.effectivePartitionField).toBe('repClass')
    expect(display.rowsField).toBe('')
  })

  // The arrangement, the row colours and the hidden categories all name rows by
  // value, so none of them means anything under a new partition.
  it('drops the row state keyed on the old partition', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b'], ['sample', 'clade']), ctgA)
    display.setRowOrder([{ name: 'b' }, { name: 'a' }], { tree: '(b,a);' })
    display.applyRowEdits([{ name: 'b', color: '#00f' }, { name: 'a' }])
    display.setHiddenCategories(['a'])

    display.setRowsField('clade')

    expect(display.rowsField).toBe('clade')
    expect(display.rowDomain).toEqual([])
    expect(display.rowColors.size).toBe(0)
    expect(display.hiddenCategories).toEqual([])
    expect(display.rowTree).toBeUndefined()
  })

  // The focus is a set of row names, so a reorder or re-cluster leaves it
  // valid; a repartition is the one thing here that renames the rows.
  it('drops a focus naming rows the new partition cannot have', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(
      0,
      regionData(['a', 'b', 'c'], ['sample', 'clade']),
      ctgA,
    )
    display.setRowFocus(['a', 'b'])
    expect(rowNames(display)).toEqual(['a', 'b'])

    display.setRowsField('clade')
    display.setRpcData(0, regionData(['x', 'y'], ['sample', 'clade']), ctgA)

    expect(display.rowFocus).toBeUndefined()
    expect(rowNames(display)).toEqual(['x', 'y'])
  })

  // A focus saved against rows since renamed would otherwise blank the
  // display.
  it('shows every row under a focus naming none of them', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b', 'c']), ctgA)

    display.setRowFocus(['nobody'])

    expect(rowNames(display)).toEqual(['a', 'b', 'c'])
  })

  // Against the effective field, not the slot: under auto the menu checks
  // whatever the worker picked, so picking that same radio arrives as a name the
  // slot does not hold and would read as a repartition.
  it('leaves everything alone when the partition is already that', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b'], ['sample']), ctgA)
    display.setRowOrder([{ name: 'b' }, { name: 'a' }], { tree: '(b,a);' })
    expect(display.rowsField).toBe('')

    display.setRowsField(display.effectivePartitionField)

    expect(display.rowDomain).toEqual(['b', 'a'])
    expect(display.rowTree).toBe('(b,a);')
  })
})

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
    display.setLayoutAndClusterTree(
      [{ name: 'c' }, { name: 'a' }, { name: 'b' }],
      '((c,a),b);',
    )

    expect(rowNames(display)).toEqual(['c', 'a', 'b'])
    expect(display.hierarchy).toBeDefined()
  })

  // No `setLayout` call happens here: the rows move because a later region
  // revealed a partition value the clustering run never saw.
  it('stops positioning when a later region widens the row set', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b', 'c']), ctgA)
    display.setLayoutAndClusterTree(
      [{ name: 'c' }, { name: 'a' }, { name: 'b' }],
      '((c,a),b);',
    )

    display.setRpcData(1, regionData(['a', 'd']), ctgB)

    expect(rowNames(display)).toEqual(['c', 'a', 'b', 'd'])
    expect(display.clusterTree).toBe('((c,a),b);')
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
    expect(display.partitionField).toBe('')
    expect(display.effectivePartitionField).toBe('name')

    display.setRpcData(
      0,
      regionData(['LINE'], ['repClass', 'name'], 'repClass'),
      ctgA,
    )

    expect(display.effectivePartitionField).toBe('repClass')
    expect(display.partitionField).toBe('')
  })

  // `layout` names rows by value, and `getSources` appends a row a layout omits
  // rather than dropping it, so under a new partition the old row set comes back
  // beside the new one, empty, each with whatever color it had.
  it('drops the row state keyed on the old partition', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b'], ['sample', 'clade']), ctgA)
    display.setLayoutAndClusterTree([{ name: 'b' }, { name: 'a' }], '(b,a);')
    display.setHiddenCategories(['a'])

    display.setPartitionField('clade')

    expect(display.partitionField).toBe('clade')
    expect(display.layout).toEqual([])
    expect(display.hiddenCategories).toEqual([])
    expect(display.clusterTree).toBeUndefined()
  })

  // The subtree filter is a set of row names, so a reorder or re-cluster leaves
  // it valid; a repartition is the one thing here that renames the rows.
  it('drops a subtree filter naming rows the new partition cannot have', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(
      0,
      regionData(['a', 'b', 'c'], ['sample', 'clade']),
      ctgA,
    )
    display.setSubtreeFilter(['a', 'b'])
    expect(rowNames(display)).toEqual(['a', 'b'])

    display.setPartitionField('clade')
    display.setRpcData(0, regionData(['x', 'y'], ['sample', 'clade']), ctgA)

    // Without the clear this is [], a blank canvas with no row labels.
    expect(display.subtreeFilter).toBeUndefined()
    expect(rowNames(display)).toEqual(['x', 'y'])
  })

  // Against the effective field, not the slot: under auto the menu checks
  // whatever the worker picked, so picking that same radio arrives as a name the
  // slot does not hold and would read as a repartition.
  it('leaves everything alone when the partition is already that', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b'], ['sample']), ctgA)
    display.setLayoutAndClusterTree([{ name: 'b' }, { name: 'a' }], '(b,a);')
    expect(display.partitionField).toBe('')

    display.setPartitionField(display.effectivePartitionField)

    expect(display.layout).toEqual([{ name: 'b' }, { name: 'a' }])
    expect(display.clusterTree).toBe('(b,a);')
  })
})

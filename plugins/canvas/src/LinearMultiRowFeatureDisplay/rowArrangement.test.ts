import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// The rows this display draws are discovered from the loaded features, not
// declared: `sourcesWithoutLayout` is the distinct `partitionField` values
// across `rpcDataMap`. So the row set grows as regions load, with no action to
// hook an invalidation onto.
function regionData(
  partitionValues: string[],
  partitionCandidates: string[] = [],
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
  }
}

function rowNames(display: { sources: { name: string }[] }) {
  return display.sources.map(s => s.name)
}

describe('the dendrogram positions only while it describes the rows', () => {
  it('positions against a clustered order', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b', 'c']))
    display.setLayoutAndClusterTree(
      [{ name: 'c' }, { name: 'a' }, { name: 'b' }],
      '((c,a),b);',
    )

    expect(rowNames(display)).toEqual(['c', 'a', 'b'])
    expect(display.hierarchy).toBeDefined()
  })

  // No `setLayout` call happens here — the rows move because a later region
  // revealed a partition value the clustering run never saw.
  it('stops positioning when a later region widens the row set', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b', 'c']))
    display.setLayoutAndClusterTree(
      [{ name: 'c' }, { name: 'a' }, { name: 'b' }],
      '((c,a),b);',
    )

    display.setRpcData(1, regionData(['a', 'd']))

    expect(rowNames(display)).toEqual(['c', 'a', 'b', 'd'])
    expect(display.clusterTree).toBe('((c,a),b);')
    expect(display.hierarchy).toBeUndefined()
  })
})

// The "Partition by..." menu writes this. Its options are the attribute names
// the loaded features carry, which the worker samples and ships beside the rows.
describe('repartitioning', () => {
  it('offers the names the loaded regions carry, unioned and sorted', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.partitionCandidates).toEqual([])

    display.setRpcData(0, regionData(['a'], ['repFamily', 'repClass']))
    display.setRpcData(1, regionData(['b'], ['repClass', 'strain']))

    expect(display.partitionCandidates).toEqual([
      'repClass',
      'repFamily',
      'strain',
    ])
  })

  // `layout` names rows by VALUE, so under a new partition its entries name
  // rows that no longer exist — and `getSources` appends a row a layout omits
  // rather than dropping it, so the old row set would have come back beside the
  // new one, empty, each with whatever colour it had been given.
  it('drops the row state keyed on the old partition', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b'], ['sample', 'clade']))
    display.setLayoutAndClusterTree([{ name: 'b' }, { name: 'a' }], '(b,a);')
    display.setHiddenCategories(['a'])

    display.setPartitionField('clade')

    expect(display.partitionField).toBe('clade')
    expect(display.layout).toEqual([])
    expect(display.hiddenCategories).toEqual([])
    expect(display.clusterTree).toBeUndefined()
  })

  // The subtree filter is a set of row NAMES, matched with no tree involved, so
  // a reorder or a re-cluster leaves it valid and `setLayout` keeps it. A
  // repartition is the one thing here that renames the rows, and the old names
  // then match none of the new ones.
  it('drops a subtree filter naming rows the new partition cannot have', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b', 'c'], ['sample', 'clade']))
    display.setSubtreeFilter(['a', 'b'])
    expect(rowNames(display)).toEqual(['a', 'b'])

    display.setPartitionField('clade')
    display.setRpcData(0, regionData(['x', 'y'], ['sample', 'clade']))

    // without the clear this is [], i.e. a blank canvas with no row labels
    expect(display.subtreeFilter).toBeUndefined()
    expect(rowNames(display)).toEqual(['x', 'y'])
  })

  it('leaves everything alone when the partition is already that', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, regionData(['a', 'b'], ['sample']))
    display.setLayoutAndClusterTree([{ name: 'b' }, { name: 'a' }], '(b,a);')

    display.setPartitionField(display.partitionField)

    expect(display.layout).toEqual([{ name: 'b' }, { name: 'a' }])
    expect(display.clusterTree).toBe('(b,a);')
  })
})

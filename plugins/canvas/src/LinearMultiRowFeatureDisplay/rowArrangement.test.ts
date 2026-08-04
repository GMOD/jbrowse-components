import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// The rows this display draws are discovered from the loaded features, not
// declared: `sourcesWithoutLayout` is the distinct `partitionField` values
// across `rpcDataMap`. So the row set grows as regions load, with no action to
// hook an invalidation onto.
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
